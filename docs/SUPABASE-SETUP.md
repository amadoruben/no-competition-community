# Ligar a No Competition Community a um projecto Supabase

Guia operacional, passo a passo. Nenhum valor secreto entra no repositório, no chat ou no código: entram só no ficheiro `.env.local` (máquina local, ignorado pelo Git) e no gestor de variáveis da Vercel.

## 0. Confirmar o projecto certo

Use **um projecto Supabase dedicado** à NCC. Nunca reutilize um projecto de outro produto: a migração `0001` activa RLS em todas as tabelas do schema `public`, o que bloquearia esse produto.

A aplicação protege-se disto: `db:migrate`, `db:seed`, `db:import`, `user:role` e o build da Vercel **recusam** correr numa base que tenha tabelas ou migrações de outra aplicação (`src/db/guard.ts`), e `supabase:check` recusa URLs e chaves de projectos diferentes misturados.

## 1. Os cinco valores e onde estão

Dashboard do Supabase → projecto da NCC:

| # | Variável | Onde | Secreto? |
|---|---|---|---|
| 1 | `DATABASE_URL` | botão **Connect** (topo) → **Transaction pooler** (porta **6543**) | **sim** |
| 2 | `DATABASE_MIGRATION_URL` | **Connect** → **Session pooler** (porta **5432**) | **sim** |
| 3 | `NEXT_PUBLIC_SUPABASE_URL` | **Project Settings → API Keys** → Project URL (`https://<ref>.supabase.co`) | não |
| 4 | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Project Settings → API Keys** → Publishable key (`sb_publishable_…`) | não |
| 5 | `SUPABASE_SERVICE_ROLE_KEY` | **Project Settings → API Keys** → Secret keys (`sb_secret_…`) | **sim** |

Nos URLs 1 e 2, substitua `[YOUR-PASSWORD]` pela palavra-passe da base de dados (**Project Settings → Database → Reset database password** se não a tiver). Caracteres especiais na palavra-passe têm de ser codificados (`@` → `%40`, `#` → `%23`, `/` → `%2F`); mais simples: gerar uma palavra-passe só com letras e números.

Porquê dois URLs: a aplicação em serverless usa o *transaction pooler*; as migrações precisam de uma sessão (lock exclusivo), por isso usam o *session pooler*. Ambos funcionam em IPv4 (a Vercel é IPv4).

## 2. Configurar a autenticação no Supabase

**Authentication → URL Configuration**
- *Site URL*: `http://localhost:3000` enquanto testa localmente (depois, o domínio de produção).
- *Redirect URLs* — adicionar:
  - `http://localhost:3000/**`
  - `https://no-competition-community-git-claude-no-compet-150e52-amadoruben.vercel.app/**` (preview desta branch)
  - mais tarde: `https://<domínio de produção>/auth/callback` e `/reset-password`

**Links de email em qualquer dispositivo (opcional, recomendado):** com os modelos por omissão, o link de confirmação e o de recuperação só funcionam no browser onde o pedido foi feito (PKCE). Para funcionarem noutro dispositivo, em **Authentication → Emails → Templates** troque o link por:
- *Confirm signup*: `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`
- *Reset password*: `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`

A aplicação aceita os dois formatos (`/auth/callback` e `/reset-password`).

**Authentication → Sign In / Providers → Email**: activo. *Confirm email* pode ficar ligado: o SMTP por omissão do Supabase só entrega a membros da equipa da organização — o seu próprio email serve para validar; para outros utilizadores é preciso SMTP próprio (`docs/OPERATIONS.md` §8).

## 3A. Testar na sua máquina (recomendado para a primeira validação)

```bash
git clone https://github.com/amadoruben/no-competition-community && cd no-competition-community
git checkout claude/no-competition-mvp
npm ci
cp .env.supabase.example .env.local      # depois preencha os 5 valores no editor
```

```bash
npm run supabase:check -- --auth-roundtrip   # 1. diagnóstico (não imprime segredos)
npm run db:migrate                           # 2. cria as tabelas (idempotente)
npm run supabase:bootstrap                   # 3. cria o bucket privado de ficheiros
npm run supabase:check                       # 4. deve terminar com "0 error(s)"
npm run dev                                  # 5. http://localhost:3000
```

O que o `supabase:check` verifica, sem mostrar valores: que os cinco valores são do **mesmo** projecto; modos de pooler correctos; chave pública não é secreta (e vice-versa); ligação com os dois URLs; base vazia ou da NCC; migrações pendentes; API de Auth acessível; se a confirmação de email está ligada; bucket existe e é privado. Com `--auth-roundtrip` cria um utilizador temporário confirmado, faz login com a chave pública (a mesma chamada da página de login) e apaga-o.

### Validar o login real
1. `http://localhost:3000/register` → criar conta com **o seu** email.
2. Se *Confirm email* estiver ligado: abrir o email do Supabase → o link passa por `/auth/callback` e entra no painel. Se estiver desligado: entra directamente.
3. Terminar sessão → `/login` com a mesma conta. Testar também `/forgot-password`.
4. Tornar-se investidor (não há forma de o fazer pela web, por segurança):
   ```bash
   npm run user:role -- o.seu@email.pt investor
   ```
   Voltar a entrar: aparece o painel do investidor (`/admin`). Para avaliadores: `… avaliador@… evaluator`.
5. Confirmar no Supabase: **Authentication → Users** mostra a conta; **Table Editor → users** mostra o perfil com o mesmo email.

Dados de demonstração **não** devem ir para um projecto que venha a ser de produção. Se este projecto for só de demonstração: `APP_ENV=demo npm run db:seed` e `DEMO_MODE=1`.

## 3B. Testar na Vercel (permite-me verificar o deploy daqui)

Vercel → projecto **no-competition-community** → **Settings → Environment Variables** → *Add*. Comece **só com o ambiente Preview** (a branch `main`/Production fica intocada até decidir).

Já configurado (Preview, branch `claude/no-competition-mvp`): `NEXT_PUBLIC_SUPABASE_URL`, `APP_ENV=preview`, `AUTH_PROVIDER=supabase`, `STORAGE_PROVIDER=supabase`, `DEMO_MODE=0`. Faltam os quatro valores 1, 2, 4 e 5 — em *Environments* escolha **Preview** e, em *Branch*, `claude/no-competition-mvp`:

| Nome | Valor | Ambiente | *Sensitive* |
|---|---|---|---|
| `DATABASE_URL` | valor 1 | Preview | ✓ |
| `DATABASE_MIGRATION_URL` | valor 2 | Preview | ✓ |
| `NEXT_PUBLIC_SUPABASE_URL` | valor 3 | Preview | — |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | valor 4 | Preview | — |
| `SUPABASE_SERVICE_ROLE_KEY` | valor 5 | Preview | ✓ |
| `APP_ENV` | `preview` (ou `demo`) | Preview | — |
| `AUTH_PROVIDER` | `supabase` | Preview | — |
| `STORAGE_PROVIDER` | `supabase` | Preview | — |
| `DEMO_MODE` | `0` (ou `1` se o projecto for só de demonstração) | Preview | — |

`APP_URL` fica vazio em Preview (cada preview tem o seu endereço; a app usa o do pedido). Em Production será o domínio final.

Depois: **Deployments** → último deploy da branch `claude/no-competition-mvp` → **⋯ → Redeploy** (ou diga-me e eu faço um push). O build, por esta ordem: corre `supabase:check` (mesmo projecto em todos os valores, chaves do tipo certo, ligação, base vazia ou da NCC, Auth e — fora de produção — um login real com um utilizador temporário que é apagado a seguir); aplica as migrações; cria o bucket privado. Qualquer erro **falha o build** antes de escrever; se a base pertencer a outro produto, nada é alterado. Eu verifico daqui: logs do build, `/api/health` (deve dar `200` com `database.ok=true`) e o login.

## 4. Depois de validado

- Produção: um **segundo** projecto Supabase (ou este, se nunca receber dados de demonstração), variáveis no ambiente *Production* com `APP_ENV=production`, `DEMO_MODE=0`, `APP_URL=https://<domínio>`.
- SMTP próprio antes de abrir registos ao público (`docs/OPERATIONS.md` §8).
- Backups independentes: secrets `BACKUP_DATABASE_URL` e `BACKUP_ENCRYPTION_KEY` no GitHub (`docs/OPERATIONS.md` §4).
- *Security Advisor* do Supabase: deve mostrar zero tabelas sem RLS.
