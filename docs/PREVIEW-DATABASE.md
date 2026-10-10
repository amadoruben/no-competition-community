# Base de dados exclusiva para a Preview

**Porquê:** hoje a Preview (branch `claude/no-competition-mvp`) e a Production usam o mesmo projecto Supabase (`nbexcezniqczbxlkephk`). Qualquer conta, publicação ou teste feito na Preview fica na base de Production.

**Objectivo:** a Preview passa a usar um projecto Supabase só seu. A base de Production não é tocada: não se copiam, alteram nem apagam dados.

## Estado verificado (10/10/2026)

- O projecto da NCC foi criado pela integração Supabase da Vercel (Vercel Marketplace), numa organização Supabase gerida pela Vercel.
- A organização Supabase pessoal ("Amado Ruben", plano gratuito) já tem 2 projectos activos (`personal-saas-prod`, `convertewebinar`). O Supabase recusa um terceiro projecto gratuito activo nessa conta — tentativa feita, recusada, nada criado. Não se pausa nem altera nenhum desses projectos.
- O agente não tem permissão para gerir a integração Supabase da Vercel; por isso a criação da base é o único passo manual.

## Passo manual (≈10 minutos)

### 1. Criar o projecto
Vercel → equipa *amadoruben* → **Storage** → **Create Database** → **Supabase** → plano **Free** → região **Washington, D.C. (us-east-1)** (a mesma das funções, `iad1`) → nome `ncc-preview`.

Se o assistente pedir para ligar a base a um projecto: **não ligar ao `no-competition-community`** — os nomes das variáveis colidiriam com as de Production já criadas pela integração. Os valores são copiados à mão no passo 3, apenas para a Preview.

### 2. No painel Supabase do novo projecto (`ncc-preview`)
- **Project Settings → API Keys:** copiar *Project URL*, *Publishable key* e *Secret key*.
- **Connect → Transaction pooler:** copiar a connection string (porta 6543) com a palavra-passe da base.
- **Authentication → URL Configuration:**
  - *Site URL:* `https://no-competition-community-git-claude-no-compet-150e52-amadoruben.vercel.app`
  - *Redirect URLs:* `https://no-competition-community-git-claude-no-compet-150e52-amadoruben.vercel.app/**` e `https://no-competition-community-*-amadoruben.vercel.app/**`
- **Authentication → Sign In / Providers → Email:** *Confirm email* **ligado** (é o valor por omissão; não desligar).

### 3. Na Vercel: variáveis só desta branch
Vercel → `no-competition-community` → **Settings → Environment Variables**. Para cada linha: *Environment* = **Preview**, *Branch* = `claude/no-competition-mvp`. Se já existir uma variável com esse nome para esta branch, **editá-la**; não mexer nas variáveis de Production.

| Nome | Valor | Tipo |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do `ncc-preview` | normal (já existe: editar) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key do `ncc-preview` | normal |
| `SUPABASE_SECRET_KEY` | Secret key do `ncc-preview` | **Sensitive** |
| `DATABASE_URL` | Transaction pooler do `ncc-preview`, com a palavra-passe | **Sensitive** (já existe: editar) |

Os valores não devem ser enviados no chat nem colocados no Git.

As variáveis da integração (`POSTGRES_URL`, `SUPABASE_URL`, …) continuam a apontar para Production e não são usadas pela Preview: a aplicação dá prioridade a `DATABASE_URL`, e as variáveis da branch substituem as gerais da Preview.

### 4. Depois (feito pelo agente)
1. Criar `PRODUCTION_SUPABASE_REF=nbexcezniqczbxlkephk` (Preview, branch acima). A partir daí, **um build de Preview que aponte para o projecto de Production falha** em vez de escrever nele (`src/lib/supabase-env.ts`, testado em `src/lib/__tests__/supabase-env.test.ts`).
2. Novo deploy da Preview. O build, sem intervenção:
   - verifica que URL, chaves e base são do mesmo projecto e que não é o de Production;
   - aplica as 4 migrações (incluindo o bloqueio de RLS em todas as tabelas);
   - cria o bucket privado de ficheiros;
   - confirma que a chave pública não lê nenhuma linha.
3. Testes reais com sessão iniciada na Preview (registo, publicação, vídeos exclusivos, desafios, papéis), com contas de teste criadas na nova base.

A Preview começa vazia. A conta do dono volta a ser criada pelo registo normal (`OWNER_EMAILS` já está definido para a Preview).

## Alternativa sem a Vercel
Criar o projecto noutra conta Supabase cujo dono ainda tenha vaga no plano gratuito (máximo de 2 projectos gratuitos activos por dono). Os passos 2–4 são iguais.
