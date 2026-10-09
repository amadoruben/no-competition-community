# Arquitectura

## Visão geral

```
Browser ──► Next.js (App Router, React Server Components, Server Actions)
              │
              ├─ src/app/**            páginas, acções de formulário, rotas HTTP
              │     └─ actions.ts      fina: sessão → serviço → estado do formulário
              ├─ src/server/**         regras de negócio e permissões (sem Next, testável)
              │     ├─ auth/           AuthProvider  ── local | supabase
              │     ├─ storage/        StorageProvider ── local | supabase
              │     └─ *.ts            desafios, participação, avaliação, resultados, …
              ├─ src/lib/**            lógica pura: fases, pontuação ponderada, pontos
              └─ src/db/**             Drizzle (pg-core), migrações, export/import
                    │
                    ▼
              PostgreSQL (Supabase, ou qualquer outro) — migrações em drizzle/
```

A interface nunca fala com a base de dados nem com o fornecedor: chama serviços. Os serviços validam (zod), verificam permissões e escrevem em transacções. Nada do browser acede directamente ao Postgres.

## Camadas e regras

| Camada | Pode depender de | Não pode depender de |
|---|---|---|
| `src/lib` (puro) | nada | BD, Next, fornecedores |
| `src/db` | drizzle, drivers | Next, fornecedores de auth/ficheiros |
| `src/server` | `db`, `lib`, interfaces `auth/` e `storage/` | componentes React, `next/navigation` |
| `src/app`, `src/components` | `server`, `lib` | SDKs de fornecedores |

Os únicos ficheiros que importam SDKs Supabase são `src/server/auth/supabase.ts`, `src/server/auth/provision.ts`, `src/server/storage/supabase.ts`, `src/proxy.ts` e `scripts/supabase-bootstrap.ts`.

## Domínio

Factos guardados, agregados derivados:

- **Participação** (`participations`), **submissão** (`submissions`), **avaliação** (`evaluations`), **resultado/vitória** (`results`), **prémio** (`results.prize_id` → `prizes`) e **decisão de investimento** (`opportunities`) são registos separados. Vencer nunca cria financiamento.
- Fase do desafio, notas finais, classificações e pontos são **calculados na leitura** (`src/lib/challenge-state.ts`, `scoring.ts`, `points.ts`).
- **Mérito ≠ popularidade:** reacções não dão pontos; pontos de participação têm limite diário; mérito vem só de resultados publicados.
- **Histórico de decisões** (`decision_log`) é só de inserção e gravado na mesma transacção da alteração.

### Confidencialidade da avaliação (aplicada no servidor)

`reviewBoard()` constrói a vista a partir do perfil:

| | Investidor | Avaliador atribuído | Membro |
|---|---|---|---|
| Notas de outros avaliadores | ✓ | ✗ (só as suas) | ✗ |
| Médias e ranking provisório | ✓ | ✗ | ✗ |
| Resultados confirmados antes de publicar | ✓ | ✗ | ✗ |
| Histórico de decisões | ✓ | ✗ | ✗ |
| Feedback | ✓ | o seu | o da sua equipa, após publicação |

Testado em `src/server/__tests__/flow.test.ts` (o avaliador nunca recebe dados de colegas, nem no JSON serializado).

## Base de dados

- **Tecnologia:** PostgreSQL ≥ 15 (testado em 16 local e PGlite; Supabase actual usa 17). Sem extensões nem funcionalidades proprietárias.
- **Drivers intercambiáveis** (`src/db/index.ts`): `postgres://…` → postgres.js (com `prepare: false`, compatível com poolers em modo transacção); `pglite://memory|<dir>` → Postgres embutido para testes e desenvolvimento sem servidor.
- **Migrações versionadas** em `drizzle/` (geradas com `npm run db:generate`, aplicadas com `npm run db:migrate`, protegidas por *advisory lock*).
- **RLS** activo em todas as tabelas sem políticas (`drizzle/0001_rls_lockdown.sql`): a Data API do Supabase (anon/authenticated) não vê nada; a aplicação liga-se como dona das tabelas. Um teste falha se alguma tabela nova ficar sem RLS.
- **IDs** UUID; **datas** `timestamptz`; **JSON** `jsonb`.

## Autenticação (`src/server/auth/`)

Interface `AuthProvider` (signIn, signUp, currentIdentity, signOut, requestPasswordReset, completePasswordReset, provisionIdentity). A aplicação só vê `{ subject, email }` e liga-o ao seu utilizador por `users.auth_subject`.

- `local`: identidades nas tabelas `auth_*` da própria BD (bcrypt custo 11, sessões opacas com hash SHA-256, cookies httpOnly/SameSite=Lax/Secure, limitação de tentativas, recuperação com token de uso único que revoga sessões).
- `supabase`: Supabase Auth via `@supabase/ssr`; identidade validada no servidor (`getUser`), sessão refrescada em `src/proxy.ts`.

**Trocar de fornecedor:** implementar a interface, registá-la em `auth/index.ts`, migrar identidades (ver OPERATIONS.md §7) e voltar a ligar `auth_subject` por email — `resolveUser()` já liga automaticamente contas existentes sem subject.

## Ficheiros (`src/server/storage/`)

Interface `StorageProvider` (put/get/delete/signedUrl). A BD guarda só uma **chave neutra** (`files.storage_key`, ex.: `projects/<id>/<uuid>.png`); o URL estável é `/files/<id>`, que redirecciona para um URL assinado (Supabase) ou serve o ficheiro (local). Tipo detectado pelos bytes (PNG/JPEG/WebP), máximo 2 MB.

## Resiliência

- Timeouts de ligação (10 s) e de instrução (15 s) configuráveis.
- `isInfraUnavailable()` classifica erros de rede/SQLSTATE 08/53/57; as acções respondem "A operação não foi guardada" — sucesso só é mostrado depois de a transacção confirmar.
- `/api/health` (BD com timeout de 3 s) → 200/503; o ecrã de erro consulta-o para distinguir indisponibilidade de outros erros.
- Logs JSON estruturados com redacção de segredos (`src/server/logger.ts`); `onRequestError` regista erros de servidor.

## Versões (instaladas e testadas)

| Componente | Versão |
|---|---|
| Node.js | 22.22.0 (engines `>=22.12`) |
| Next.js | 16.4.0 |
| React / React DOM | 19.3.0 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.3.3 |
| Drizzle ORM / Kit | 0.45.4 / 0.31.11 |
| postgres (postgres.js) | 3.4.9 |
| @electric-sql/pglite | 0.5.8 |
| @supabase/supabase-js / @supabase/ssr | 2.117.1 / 0.12.7 |
| zod | 4.6.5 |
| bcryptjs | 3.0.3 |
| nodemailer | 10.0.10 (fixada; só auth local) |
| Vitest / Playwright | 5.0.3 / 1.64.0 |
| PostgreSQL de teste | 16.15 (local, CI) · PGlite 0.5.8 |

Compatibilidade verificada: Supabase recomenda o pooler em modo transacção para serverless e exige desactivar *prepared statements* (feito: `prepare: false`); migrações e `pg_dump` usam ligação directa ou pooler em modo sessão. **Não verificado:** a lista actual de versões Node suportadas pela Vercel (a documentação consultada só mostra o exemplo `24.x`); a aplicação foi testada em Node 22.

`npm audit` reporta vulnerabilidades apenas em ferramentas de desenvolvimento (`drizzle-kit` → esbuild antigo; `eslint-config-next` → braces/micromatch). Não entram no bundle de produção; as "correcções" propostas são downgrades. Reavaliar quando houver versões novas dessas ferramentas.
