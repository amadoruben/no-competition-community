# Base de dados exclusiva para a Preview

**Porquê:** a Preview (branch `claude/no-competition-mvp`) e a Production usam hoje o mesmo projecto Supabase (`nbexcezniqczbxlkephk`). Tudo o que se faz na Preview fica na base de Production.

**Objectivo:** a Preview passa a usar um projecto Supabase só seu. A base de Production, a integração existente e os outros projectos (Convertewebinar, personal-saas-prod, deskcomm-dev) não são tocados.

## O que foi verificado (10/10/2026)

- **Onde está a NCC.** Numa organização Supabase gerida pela Vercel, criada pela integração da Vercel. O Convertewebinar está noutra organização (a pessoal, "Amado Ruben"), que este procedimento não toca.
- **A organização pessoal não serve.** O Supabase recusou um 3.º projecto gratuito activo nessa conta: o dono já tem 2. A tentativa foi recusada e nada foi criado.
- **Numa organização gerida pela Vercel, os projectos só se criam pelo painel da Vercel.** Fonte: [supabase.com/docs/guides/integrations/vercel-marketplace](https://supabase.com/docs/guides/integrations/vercel-marketplace).
- **Um recurso novo é independente e a ligação a projectos é um passo à parte.** Cada recurso do Marketplace é uma instância separada (um projecto Supabase novo). A ligação faz-se depois em *Projects → Connect Project*, com escolha de ambientes. Fonte: [vercel.com/docs/integrations/install-an-integration/product-integration](https://vercel.com/docs/integrations/install-an-integration/product-integration). Não ligando o recurso novo, a integração existente e as variáveis de Production ficam como estão.
- **As variáveis só desta branch sobrepõem-se às gerais de Preview.** As outras Previews continuam com as gerais. Fonte: [vercel.com/docs/cli/env](https://vercel.com/docs/cli/env).
- **A aplicação dá prioridade a `DATABASE_URL` sobre a `POSTGRES_URL` da integração.** Ver `src/lib/supabase-env.ts`.

## Custo e limitações

- **Custo.** O preço é igual ao do Supabase directo. Numa organização no plano **Free** o projecto novo não tem custo. Não se podem misturar planos na mesma organização: se o assistente mostrar um plano pago ou um preço, cancelar.
- **Limite de projectos gratuitos.** São 2 activos por dono, contados em todas as organizações onde é dono ou administrador; os pausados não contam.
  - Inferência, não verificada: o dono da organização gerida pela Vercel tem hoje só a NCC (quando a NCC foi criada, a conta pessoal já tinha 2 projectos activos, por isso é outro dono). Haverá então vaga para mais um.
  - Se o assistente recusar por limite, parar: não pausar nem apagar projectos existentes.
- **Pausa por inactividade.** Projectos gratuitos com pouca actividade durante 7 dias são pausados (com aviso por email uma semana antes). Restauram-se no painel em *Resume project*, até 90 dias.
- **Email.** O SMTP por omissão do projecto novo só entrega à equipa da organização e envia poucos emails por hora. Chega para testes com contas da equipa, não para membros reais.

## Passos manuais, por ordem

1. **Criar o projecto, a partir da equipa e não do projecto.** Vercel → equipa *amadoruben* → **Integrations** → *Supabase* → **Manage** → criar um novo recurso (*Install Product* / *Create*).
   - Também se pode partir de **Storage**, ao nível da equipa.
   - Não começar no separador *Storage* da página do projecto `no-competition-community`: esse caminho liga o recurso ao projecto.
2. **Configurar no assistente:**
   - plano **Free**, sem preço indicado;
   - região **East US / Washington, D.C. (us-east-1 / iad1)**, onde correm as funções;
   - nome **`ncc-preview`**.
   - Criar.
3. **Não ligar o recurso a nenhum projecto.** Se aparecer *Connect Project*, fechar ou ignorar. Não usar prefixos.
4. **Abrir o Supabase do `ncc-preview`:** na página do recurso, *Open in Supabase*.
5. **Definir a palavra-passe da base.** *Project Settings → Database → Reset database password*.
   - Usar só letras e números (com símbolos teria de ser codificada no URL).
   - Guardar num gestor de palavras-passe.
   - Isto só afecta o projecto novo, que ainda não é usado.
6. **Configurar a autenticação.** *Authentication → URL Configuration*:
   - *Site URL:* `https://no-competition-community-git-claude-no-compet-150e52-amadoruben.vercel.app`
   - *Redirect URLs:* adicionar `https://no-competition-community-git-claude-no-compet-150e52-amadoruben.vercel.app/**`
   - Em *Authentication → Sign In / Providers → Email*, confirmar que *Confirm email* está **ligado**.
7. **Copiar os 4 valores para a Vercel.** Vercel → `no-competition-community` → **Settings → Environment Variables**.
   - Em cada linha: *Environments* = só **Preview**; *Branch* = `claude/no-competition-mvp`.
   - Se já existir a variável para essa branch, **editar**; se não, **adicionar**. Não editar variáveis sem branch nem de Production.

   | Variável | Onde obter o valor (no Supabase do `ncc-preview`) | Já existe para esta branch? | Tipo |
   |---|---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | *Project Settings → Data API* → **Project URL** (`https://<ref>.supabase.co`) | sim → editar | normal |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | *Project Settings → API Keys* → **Publishable key** (`sb_publishable_…`) | não → adicionar | normal |
   | `SUPABASE_SECRET_KEY` | *Project Settings → API Keys* → **Secret keys** → copiar (`sb_secret_…`) | não → adicionar | **Sensitive** |
   | `DATABASE_URL` | botão **Connect** → **Transaction pooler** → URI (porta **6543**); substituir `[YOUR-PASSWORD]` pela palavra-passe do passo 5 | sim → editar | **Sensitive** |

   Os valores não devem ir para o chat nem para o Git.
8. **Avisar o agente:** "feito".

## Protecção já activa no código (sem configuração na Vercel)

Um build ou servidor com `VERCEL_ENV=preview` que aponte para o projecto de Production (`nbexcezniqczbxlkephk`) — pelo URL público, pela `DATABASE_URL`, pela `POSTGRES_URL` da integração ou pelo URL de migrações — **falha antes de migrar** e não escreve nada (`previewTargetsProduction` em `src/lib/supabase-env.ts`). `PRODUCTION_SUPABASE_REF` continua a poder sobrepor o valor, mas já não é necessária.

Consequência: enquanto a Preview usar a base partilhada, um push para esta branch produz um deploy de Preview **falhado** (com a mensagem acima) e a base de Production fica intacta. A Preview só volta a ficar disponível depois dos passos manuais acima.

## Depois (pelo agente)

1. Novo deploy da Preview (push autorizado). O build:
   - verifica que URL, chaves e base são do mesmo projecto e não do de Production;
   - aplica as 6 migrações (0000–0005, com RLS) na base nova e vazia;
   - cria o bucket privado;
   - confirma que a chave pública não lê dados.
   Se algum valor estiver errado, o build falha com a variável em causa identificada, sem mostrar valores.
2. Testes reais com sessão na nova base: registo, publicação, reacções, stories da equipa, conteúdos sociais, vídeos exclusivos, desafios e os três papéis.

A Preview começa vazia. A conta do dono volta a criar-se pelo registo normal (`OWNER_EMAILS` já está definido para a Preview).

## Production

A migração 0005 (aditiva: tabela `follows`, colunas `lessons.created_at`, `users.social_links`, `reactions.kind`) só chega à base de Production com um merge para `main`, que precisa de autorização explícita.
