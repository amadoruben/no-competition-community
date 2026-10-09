# No Competition Community

Plataforma de comunidade onde um investidor lança desafios, os membros constroem e submetem projectos, avaliadores pontuam com critérios públicos e os resultados são publicados com histórico de decisões.

> Todos os dados incluídos são **fictícios, para demonstração**.

## Arrancar

Requisitos: Node 22+.

```bash
npm install
npm run dev          # http://localhost:3000 — cria e povoa a BD na primeira execução
npm run db:seed      # repõe os dados de demonstração a qualquer momento
```

Produção: `npm run build && npm start` (sem HTTPS local, use `INSECURE_COOKIES=1`). A BD é um ficheiro SQLite em `data/ncc.db` (configurável com `DATABASE_PATH`).

### Contas de demonstração

Na página de entrada há botões de acesso com um clique. Palavra-passe de todas: `demo1234`.

| Papel | Email | O que mostra |
|---|---|---|
| Investidora | `investidor@demo.ncc` | Painel, criação/publicação de desafios, avaliação, comparação, resultados, pipeline |
| Avaliadora | `avaliador@demo.ncc` | Submissões atribuídas e formulário de avaliação |
| Membro | `membro@demo.ncc` | Dashboard, desafios, projecto Voltaica, comunidade, classificações |

### Guião de demonstração (≈5 min)

1. **Investidora → Painel**: ciclo de cada desafio e a próxima acção. Abra *Finanças simples para independentes* (encerrado, em avaliação).
2. **Submissões / Comparar**: classificação provisória, notas por critério lado a lado. Avalie a *Conta Fácil* (falta a sua avaliação).
3. **Resultados**: confirme as posições sugeridas e prémios (com justificação opcional) → **Publicar resultados**. É criado um anúncio, o feedback fica visível para as equipas e os pontos de mérito são atribuídos.
4. **Pipeline**: oportunidades de investimento são registos separados dos resultados (o 2.º lugar de logística está em *Interesse*).
5. **Novo desafio**: crie um rascunho, publique, e veja-o como membro.
6. **Membro**: dashboard com tarefas pendentes → *IA para o pequeno comércio* → submeter a Voltaica.

## Arquitectura

| Camada | Onde | Notas |
|---|---|---|
| Interface | `src/app`, `src/components` | Next.js 16 (App Router), React 19, Tailwind 4. Server Components + Server Actions. |
| Acções | `src/app/actions.ts` | Fina: lê a sessão, chama o serviço, traduz erros de domínio para o formulário. |
| Regras de negócio | `src/server/*` | Validação (zod), permissões e transacções. Independente do Next (testável). |
| Lógica pura | `src/lib/*` | Fases do desafio, pontuação ponderada, pontos/rankings. Testada unitariamente. |
| Dados | `src/db` | SQLite + Drizzle, migrações em `drizzle/`, aplicadas ao abrir a ligação. |

Decisões principais:

- **Factos guardados, agregados derivados.** Fase do desafio, notas finais, rankings e pontos são calculados na leitura a partir dos factos — não há contadores a dessincronizar.
- **Participação ≠ submissão ≠ avaliação ≠ vitória ≠ prémio ≠ investimento.** Cada um é um registo próprio; vencer nunca cria financiamento.
- **Mérito ≠ popularidade.** Reacções não dão pontos. Pontos de participação têm limite diário; o mérito vem só de resultados publicados (regras em `src/lib/points.ts` e visíveis na página de classificações).
- **Avaliação:** 0–10 por critério, média ponderada (0–100) por avaliação, média das avaliações completas por submissão. Critérios ficam bloqueados (estrutura) após a primeira avaliação. Avaliadores não vêem as notas uns dos outros.
- **Histórico de decisões** (publicar, pausar, encerrar, shortlist, resultados, pipeline) é um registo só de inserção.
- **Autenticação:** email + palavra-passe (bcrypt), sessões em BD com cookie httpOnly; permissões verificadas no servidor em cada serviço.
- **SQLite** por simplicidade de operação na demo. Para produção multi-instância, migrar para Postgres (Drizzle suporta; o esquema não usa nada específico de SQLite além de JSON em texto).

Base open-source: foram avaliados Juryza, Skool Clone, Hackathon Portal, LMS Front e Hibiscus. Nenhum foi adoptado como base (domínio/stack/licença desajustados ou custo de adaptação superior). Os princípios de avaliação (rubrica ponderada, resultados derivados, unicidade como integridade) foram adaptados do **Juryza** (MIT).

## Testes

```bash
npm test             # unitários + integração das regras de negócio (BD em memória)
npm run typecheck
npm run lint
npm run test:e2e     # build + Playwright: ciclo completo no browser, telemóvel
```

O teste E2E percorre: investidora cria e publica → membro inscreve-se e submete → membro sem acesso ao painel → investidora encerra, avalia, confirma (resultados ainda privados) e publica → membro vê posição e feedback, anúncio e ranking de mérito. Em ambientes com Chromium pré-instalado: `CHROMIUM_PATH=/caminho/chrome npm run test:e2e`.

## Estado

**Funcional (persistido, com permissões):**
- Desafios: criar/editar (critérios com pesos, prémios, datas, pontos de classificação), publicar/pausar/retomar/encerrar/reabrir, catálogo com filtros, página de detalhe com regras, critérios, prémios, participantes e resultados.
- Participação: inscrição, submissão e edição até ao prazo, associação a projecto, limite de equipa.
- Avaliação: atribuição de avaliadores, formulário por critério com nota ao vivo, shortlist, comparação lado a lado, classificação provisória.
- Resultados: confirmação com prémios e justificação, publicação com anúncio automático, feedback visível para a equipa.
- Projectos: criar/editar, equipa, actualizações de progresso (com partilha no feed), página pública.
- Comunidade: feed com filtros, publicações, anúncios oficiais (só investidora), comentários, reacções.
- Classificações: geral, semanal, mérito, participação e por desafio.
- Membros: directório, perfil público com projectos, participações e conquistas; edição de perfil.
- Aprendizagem: cursos, módulos, aulas, progresso.
- Pipeline de investimento por fases (registo; sem pagamentos).

**Fora de âmbito por agora (sem requisitos):** pagamentos/contratos, upload de ficheiros (logótipos são gerados), notificações por email, recuperação de palavra-passe, edição de cursos pela UI.

**Próximos passos sugeridos:** notificações (prazo, resultados), convites de equipa por link, upload de imagens, exportação CSV de resultados, Postgres + deploy.
