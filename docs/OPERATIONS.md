# Operações: ambientes, deploy, backups e mudança de fornecedor

## 1. Ambientes

| Ambiente | `APP_ENV` | Base de dados | Auth / Ficheiros | `DEMO_MODE` |
|---|---|---|---|---|
| Local | `development` | Postgres local ou `pglite://data/pglite` | local / local | 1 |
| Testes | `test` | PGlite em memória, Postgres de teste | local / memória | — |
| Preview (Vercel) | `preview` | projecto Supabase **separado** (dados de teste) | supabase / supabase | 1 |
| Demonstração comercial | `demo` | projecto Supabase dedicado, só dados fictícios | supabase / supabase | 1 |
| Produção | `production` | projecto Supabase de produção | supabase / supabase | 0 |

Credenciais diferentes por ambiente. Nunca apontar previews para a base de produção. `npm run db:seed` recusa correr com `APP_ENV=production`.

Variáveis: ver `.env.example` (comentado). A configuração é validada no arranque (`src/server/config.ts`): falta de variáveis ou combinações inválidas (ex.: armazenamento local na Vercel) impedem o arranque com mensagem clara.

## 2. Primeiro deploy: Vercel + Supabase

Guia detalhado com a localização exacta de cada valor: [`SUPABASE-SETUP.md`](SUPABASE-SETUP.md).

Pré-requisitos que dependem do titular das contas: projecto Supabase dedicado (região próxima da função Vercel) e projecto Vercel ligado ao repositório.

1. **Supabase → Connect**: copiar a *connection string* do pooler **tal como está** (com `[YOUR-PASSWORD]`) → `DATABASE_URL`; a palavra-passe da base → `SUPABASE_DB_PASSWORD`. A aplicação insere a palavra-passe e escolhe o modo certo (6543 na app, 5432 nas migrações). A ligação directa é IPv6 e não serve na Vercel.
2. **Supabase → API keys**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (secreta; o nome antigo `SUPABASE_SERVICE_ROLE_KEY` também é aceite).
3. **Supabase → Auth → URL Configuration**: Site URL = domínio da app; Redirect URLs:
   - `https://<domínio>/auth/callback` (confirmação de email no registo)
   - `https://<domínio>/reset-password` (recuperação de palavra-passe)
   - para previews da Vercel, o padrão com wildcard `https://*-<conta>.vercel.app/**` — só no projecto Supabase de preview/demo, nunca no de produção.
4. Localmente, com essas variáveis: `npm run supabase:bootstrap` (cria o bucket privado) e, só para demo, `APP_ENV=demo npm run db:seed`.
5. **Vercel → Environment Variables** (por ambiente — *Production* e *Preview* com projectos Supabase diferentes): todas as anteriores + `APP_ENV`, `AUTH_PROVIDER=supabase`, `STORAGE_PROVIDER=supabase`, `APP_URL`, `DEMO_MODE`. Num deploy de produção da Vercel, `APP_ENV` é obrigatório (a validação recusa o valor por omissão) e o acesso de demonstração fica desligado salvo `DEMO_MODE=1` explícito.
6. Deploy (push para a branch; `vercel.json` fixa o preset Next.js e o comando `npm run vercel-build`). O build cria/actualiza o bucket privado (com `STORAGE_PROVIDER=supabase`) e aplica migrações — e recusa uma base que pertença a outro produto (`src/db/guard.ts`). As migrações são aplicadas (`db:migrate`, idempotente, com lock) quando `DATABASE_URL` existe; sem ela o build passa e a app arranca em modo "não configurado". Verificar `https://<domínio>/api/health` → `200`. Em `503`, o JSON lista **os nomes** das variáveis em falta (nunca valores).
7. Correr o *advisor* de segurança do Supabase: não deve haver tabelas sem RLS.
8. **Email (obrigatório antes de abrir registos ao público):** configurar SMTP próprio no Supabase (§8).

**Região:** a função Vercel corre por omissão em `iad1` (EUA-Leste, confirmado nos cabeçalhos do preview). Escolher o projecto Supabase na mesma região, ou mudar a região da função em *Vercel → Settings → Functions* para a do Supabase: cada pedido faz várias consultas e a latência entre continentes multiplica-se.

**Protecção de deployments:** a Vercel protege por omissão os URLs `*.vercel.app` com *Vercel Authentication*. Para uma demonstração pública: (a) domínio próprio para produção/demo, que não é afectado, ou (b) desligar a protecção só para Preview em *Settings → Deployment Protection*. É uma decisão do titular da conta.

## 3. Migrações

- Alterar `src/db/schema.ts` → `npm run db:generate` → rever o SQL em `drizzle/` → commit.
- Aplicar: `npm run db:migrate` (usa `DATABASE_MIGRATION_URL` se existir). Em produção é um passo do deploy, não do arranque (`DB_AUTO_MIGRATE` vem desligado em produção).
- Reprodutível a partir de zero: o CI aplica todas as migrações duas vezes numa base vazia.
- Migrações destrutivas: primeiro backup verificado (§4), depois migração.

## 4. Backups, exportações e testes de restauro

Três coisas distintas — nenhuma substitui as outras:

| | O quê | Onde | Porquê |
|---|---|---|---|
| **Backup do fornecedor** | snapshots diários/PITR do Supabase | no Supabase | recuperação rápida dentro do mesmo fornecedor; **não** protege contra perda da conta ou do fornecedor |
| **Backup físico independente** | `pg_dump -Fc` dos schemas `public` e `drizzle` | artefacto cifrado (GitHub Actions) ou armazenamento próprio | restauro completo noutro Postgres |
| **Exportação lógica** | JSON portável com checksum por tabela (`npm run db:export`) | idem | independente de versão/fornecedor; permite verificar integridade linha a linha |

Automatização: `.github/workflows/backup.yml` (diário, inactivo até existir o secret `BACKUP_DATABASE_URL`). Em cada execução:
1. faz o dump físico e a exportação lógica;
2. **restaura ambos** num Postgres 17 limpo e verifica checksums de todas as tabelas (falha o job se não coincidir);
3. cifra (AES-256, `BACKUP_ENCRYPTION_KEY`) e guarda 30 dias.

Guardar a chave de cifra fora do GitHub. Para retenção mais longa, copiar os artefactos para armazenamento próprio (S3/R2/B2).

Restauro manual:

```bash
# Lógico (qualquer PostgreSQL vazio):
DATABASE_URL=postgres://…/nova npm run db:import -- ncc-export.json      # migra, importa numa transacção, verifica

# Físico:
psql postgres://…/nova -c "drop schema public cascade"
pg_restore -d postgres://…/nova --no-owner --no-privileges ncc.dump
DATABASE_URL=postgres://…/nova npm run db:verify -- ncc-export.json      # prova de integridade
```

Decifrar: `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in f.enc -out f -pass env:KEY`.

As exportações contêm dados pessoais e, com auth local, hashes de palavras-passe: tratar como segredo.

## 5. Indisponibilidade e monitorização

Comportamento testado (`e2e/resilience.spec.ts`, Postgres real parado a meio):
- `/api/health` responde `503` com `database.ok=false`;
- formulários mostram "A operação não foi guardada" — nunca uma falsa confirmação; transacções garantem que nada fica a meio;
- páginas mostram "Serviço temporariamente indisponível" com "Tentar novamente";
- recuperação automática quando a base volta (sem reiniciar a aplicação).

Monitorizar:
- **Uptime:** pedir `GET /api/health` a cada minuto (qualquer serviço de uptime) e alertar em `503`.
- **Erros:** os logs são JSON (`level`, `event`, …). Na Vercel, ligar um *log drain* e alertar em `level=error` (`request.error`, `action.unavailable`, `action.failed`).
- **Limites do Supabase:** dashboard → Observability (ligações, tamanho da BD, egress, MAU de Auth, storage). Alertar a 80% do plano.
- Ligações: em serverless `DATABASE_POOL_MAX=1` por instância (padrão na Vercel) e pooler em modo transacção.

Não há base de dados secundária activa nem failover automático (sem necessidade demonstrada). Plano para indisponibilidade prolongada: restaurar o último backup verificado noutro Postgres (§4) e trocar `DATABASE_URL` (§6). Objectivo de recuperação: RPO ≤ 24 h (backup diário; menos com PITR do Supabase), RTO ≈ tempo de um restauro (minutos para a dimensão actual).

## 6. Mudar de fornecedor

### Base de dados (sair do Supabase Postgres)
1. Criar o Postgres de destino (RDS, Neon, Crunchy, servidor próprio).
2. Colocar a app em manutenção ou só leitura (parar escritas).
3. `npm run db:export` da origem; `DATABASE_URL=<destino> npm run db:import -- export.json` (migra, importa, verifica). Alternativa: `pg_dump`/`pg_restore` + `db:verify`.
4. Trocar `DATABASE_URL`/`DATABASE_MIGRATION_URL` e reiniciar. Nenhum código muda.

### Autenticação (sair do Supabase Auth)
- **Para auth local:** `AUTH_PROVIDER=local`. As palavras-passe do Supabase não são exportáveis em claro; opções: (a) pedir aos utilizadores para definir nova palavra-passe por email (fluxo `/forgot-password`, que já liga a conta existente pelo email através de `resolveUser`), ou (b) exportar os hashes bcrypt de `auth.users.encrypted_password` (acesso SQL ao projecto) para `auth_credentials.password_hash` — o formato é compatível com `bcryptjs`.
- **Para outro IdP (Auth0, Clerk, Keycloak…):** implementar `AuthProvider` (≈150 linhas, ver `supabase.ts`), registar em `auth/index.ts`, importar utilizadores no IdP e limpar `users.auth_subject`; o primeiro login liga cada conta pelo email.
- Configurar envio de email (`EMAIL_WEBHOOK_URL`) se usar auth local em produção.

### Ficheiros (sair do Supabase Storage)
1. Implementar `StorageProvider` para o destino (ex.: S3 com URLs assinados) ou usar `local` com volume persistente.
2. Copiar todos os objectos do bucket mantendo **as mesmas chaves** (`files.storage_key`) — ex.: `rclone copy` ou script com a API de Storage.
3. Trocar `STORAGE_PROVIDER`. Nenhuma linha da BD muda (URLs são `/files/<id>`).

### Alojamento (sair da Vercel)
- `Dockerfile` incluído (Node 22, build standalone, utilizador não-root, `HEALTHCHECK` em `/api/health`). Funciona em Fly.io, Railway, Render, ECS, Kubernetes ou VPS.
- Sem dependências de APIs exclusivas da Vercel: o código só lê `VERCEL` para escolher um pool pequeno e recusar armazenamento local.
- Migrações: `npm run db:migrate` como passo de release, ou `DB_AUTO_MIGRATE=1` (seguro com várias instâncias graças ao lock).
- Com armazenamento `local`, montar um volume persistente em `STORAGE_LOCAL_DIR`.

## 7. Segurança operacional

- `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) e `SUPABASE_DB_PASSWORD` só no servidor (nunca `NEXT_PUBLIC_`); rodar se exposta.
- Papel da BD da aplicação: o dono das tabelas (necessário para migrações). Para backups, preferir um papel só de leitura.
- `DEMO_MODE=0` em produção (desliga o acesso de um clique).
- Contas de demonstração (`*@demo.ncc`, palavra-passe `demo1234`) só em ambientes de demo.
- Cabeçalhos: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## 8. Email transaccional

Quem envia o quê:

| Email | Com `AUTH_PROVIDER=supabase` | Com `AUTH_PROVIDER=local` |
|---|---|---|
| Confirmação de registo, recuperação de palavra-passe | Supabase Auth, pelo SMTP configurado no Supabase | a aplicação (`src/server/mail.ts`) via `SMTP_URL` ou `EMAIL_WEBHOOK_URL` |

**O SMTP por omissão do Supabase não serve para produção** (documentação Supabase, *Auth → SMTP*): só entrega a endereços da equipa da organização ("Email address not authorized" para os restantes), com limite horário baixo e sem SLA. Com SMTP próprio, o limite inicial é 30 emails/hora — ajustar em *Auth → Rate Limits*.

Configuração: *Supabase → Authentication → Emails → SMTP Settings* (host, porta, utilizador, palavra-passe, remetente). As credenciais ficam no Supabase; não entram no repositório nem na Vercel.

### Opções

| Opção | Adequado para | Limitações |
|---|---|---|
| **Conta Gmail da NCC** (`smtp.gmail.com`, porta 465, *App Password*) | demonstração e piloto com poucos utilizadores | exige verificação em 2 passos; o *App Password* é revogado se a palavra-passe da conta mudar; limite ≈500 emails/dia numa conta pessoal (2 000 em Google Workspace); remetente `@gmail.com` tem pior entregabilidade e não permite SPF/DKIM do domínio próprio; a Google desaconselha *App Passwords* |
| **Fornecedor transaccional** (Resend, Postmark, Amazon SES, Brevo…) com domínio próprio | produção | requer domínio e registos DNS (SPF, DKIM, DMARC); planos gratuitos com limites próprios |

Recomendação: Gmail apenas para a demonstração; antes de produção, domínio próprio + fornecedor transaccional. A conta Gmail continua útil como endereço de contacto e de `Reply-To`.

Passos com Gmail (feitos pelo titular da conta, nunca em código):
1. Conta Google → Segurança → activar verificação em 2 passos.
2. Conta Google → *App passwords* → criar uma para "Supabase NCC".
3. Supabase → SMTP Settings: host `smtp.gmail.com`, porta `465`, utilizador = endereço Gmail, palavra-passe = *App Password*, remetente = o mesmo endereço.
4. Testar: registar uma conta com um endereço externo à equipa e pedir recuperação de palavra-passe; os links devem abrir `/auth/callback` e `/reset-password` no domínio certo.

Com auth local, o equivalente é `SMTP_URL=smtps://<utilizador>%40gmail.com:<app-password>@smtp.gmail.com:465` como variável **secreta** do ambiente (testado contra um servidor SMTP em `src/server/__tests__/mail.test.ts`; os logs nunca incluem o URL).
