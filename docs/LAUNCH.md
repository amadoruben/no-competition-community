# Lançamento da comunidade: o que falta e por que ordem

Estado de partida (10/10/2026): a aplicação está pronta na Preview (`claude/no-competition-mvp`). Production (`main`) tem a versão anterior. Nada aqui contrata serviços nem cria credenciais: cada passo indica quem o faz.

## Bloqueadores para abrir ao público

| # | O quê | Porquê bloqueia | Quem | Custo |
|---|---|---|---|---|
| 1 | Base de dados separada para a Preview | Os testes da Preview escrevem hoje na base de Production | Dono (criar projecto) + agente (resto) — [PREVIEW-DATABASE.md](PREVIEW-DATABASE.md) | plano gratuito |
| 2 | Domínio próprio | O SMTP precisa de um domínio verificado para enviar a qualquer pessoa | Dono (decisão e compra) | registo anual do domínio |
| 3 | SMTP próprio | O SMTP por omissão do Supabase só entrega a membros da equipa Supabase (≈2 emails/hora): os seguidores não recebem o link de confirmação | Dono (conta no fornecedor) + agente (aplica a configuração) | escalão gratuito do fornecedor |
| 4 | URLs de Auth em Production | Sem isto, os links de confirmação e recuperação abrem o endereço errado | Dono (painel Supabase) ou agente com token | — |
| 5 | Acesso público ao endereço de Production | A Deployment Protection da Vercel pode exigir login Vercel | Dono (verificar) | — |
| 6 | Publicar em Production | Merge de `claude/no-competition-mvp` para `main` | Dono autoriza; agente executa | — |

### 2. Domínio
Recomendado: um domínio da marca (ex.: `nocompetition.<tld>`), com um subdomínio só para emails de autenticação (`auth.<domínio>`, remetente `no-reply@auth.<domínio>`). O preço depende do registrar e da extensão; não foi contratado nada.

### 3. SMTP
A comparação de fornecedores (preços lidos nas páginas oficiais) e a configuração num comando estão em [OPERATIONS.md §8](OPERATIONS.md#8-email-transaccional). Resumo:
- **Resend** (gratuito: 3 000/mês, 100/dia) para começar; **ZeptoMail** (região UE) se os dados de email tiverem de ficar na UE.
- Ambos exigem o domínio verificado (SPF, DKIM, DMARC), o que torna o passo 2 pré-requisito.
- Aplicar com `npm run supabase:auth-config -- --apply`, que configura SMTP, remetente, Site URL, Redirect URLs e os modelos em português. Precisa de `SUPABASE_ACCESS_TOKEN` (token pessoal, revogado no fim) e da credencial SMTP, num `.env.local` fora do Git.
- **Teste obrigatório:** registo com um email fora da equipa Supabase → link → sessão; recuperação de palavra-passe; verificar a pasta de spam.
- O limite do plano gratuito da Resend (100/dia) pode esgotar-se num pico de registos no lançamento.

### 4. Supabase Auth em Production (projecto `nbexcezniqczbxlkephk`)
*Authentication → URL Configuration:*
- **Site URL:** o endereço público de Production (o domínio próprio quando existir; até lá `https://no-competition-community.vercel.app`).
- **Redirect URLs:** `<endereço de Production>/**`. Não incluir os padrões das Previews no projecto de Production — as Previews terão o seu próprio projecto.
- *Confirm email* ligado. Com `OWNER_EMAILS` definido, o build falha se estiver desligado, porque qualquer pessoa poderia registar o email do dono.

### 5. Acesso público
Abrir o endereço de Production numa janela anónima. Se pedir login da Vercel, ajustar *Settings → Deployment Protection* para proteger só as Previews. Não verificado pelo agente: o proxy do ambiente bloqueia o acesso directo.

### 6. Publicar
Depois de 1–5, e com os testes reais da Preview verdes:
- Merge do PR para `main`. A Vercel publica, e o build verifica configuração, RLS e storage e aplica as migrações.
- Em Production, `OWNER_EMAILS` já está definido: entrar com o email do dono, confirmado, dá o papel de administração.

## Conteúdo inicial (administração, depois de entrar)
1. **Início → Partilhe algo com a comunidade… → Anúncio oficial**: a mensagem de boas-vindas fica fixada no topo para todos (com fotografias, se quiser).
2. **Administração → Gerir vídeos**: criar uma colecção (aberta ou exclusiva) e colar o link do primeiro vídeo (YouTube, incluindo "não listado", Vimeo ou `.mp4`).
3. **Administração → Novo desafio**: tema, regras, datas, critérios com pesos e prémios → guardar (rascunho) → **Publicar**.
4. **Membros e acessos**: nomear avaliadores e atribuí-los ao desafio; dar acesso completo a quem deve ver as colecções exclusivas.

Estes quatro fluxos estão cobertos por testes automáticos (`e2e/community.spec.ts`, `e2e/challenge-lifecycle.spec.ts`, `e2e/roles.spec.ts`).

## Feed da comunidade: o que existe e o que não existe
- **Publicar:** texto com links, título opcional, até 6 fotografias (redimensionadas no dispositivo para 1600 px e verificadas no servidor: tipo, tamanho e dimensões) **ou** um vídeo por link (YouTube, Vimeo ou ficheiro `.mp4` https). Tipos: Conversa, Pergunta, Progresso; Anúncio oficial só para a administração, fixado no topo.
- **Interagir:** gosto (um por pessoa; tocar de novo retira), comentários com respostas (um nível), guardar (privado), partilhar (folha de partilha do dispositivo ou link copiado; o link só abre com sessão iniciada), menu "⋯" com as acções permitidas (copiar link, editar o próprio texto, fixar, remover).
- **Isolamento:** contas de demonstração e contas reais nunca vêem as publicações umas das outras.
- **Não existe (decisão consciente):** carregar ficheiros de vídeo. Um pedido na Vercel aceita no máximo 4,5 MB; vídeos exigiriam envio directo para o Storage com URLs assinados, limites por plano e eventualmente processamento — fica para quando houver necessidade e orçamento. Também não há notificações nem vários tipos de reacção (o modelo permite acrescentá-los).
- **Base de dados:** a migração `0004_feed_media_replies_saved` é só aditiva (tabelas `post_media` e `saved_posts`, colunas novas em `posts` e `comments`, RLS nas tabelas novas). O código anterior continua a funcionar com ela.
