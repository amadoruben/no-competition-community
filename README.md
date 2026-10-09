# No Competition Community

Plataforma onde um investidor lança desafios, os membros constroem e submetem projectos, avaliadores pontuam com critérios públicos e os resultados são publicados com histórico de decisões. Prémios e investimento são registos separados.

> Os dados de demonstração são **fictícios**.

- Arquitectura e versões: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Deploy, backups, monitorização e mudança de fornecedor: [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- Design system: [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) · referência viva em `/design`

## Arrancar localmente

Requisitos: Node ≥ 22.12. Base de dados: um PostgreSQL local **ou** nenhum (Postgres embutido PGlite).

```bash
npm install
cp .env.example .env.local
# Sem servidor Postgres: em .env.local use DATABASE_URL=pglite://data/pglite
npm run dev          # aplica migrações e, se a base estiver vazia, carrega a demonstração
```

`npm run db:seed` repõe os dados de demonstração. Contas (palavra-passe `demo1234`, botões de um clique em `/login` quando `DEMO_MODE=1`):

| Papel | Email |
|---|---|
| Investidora | `investidor@demo.ncc` |
| Avaliadora | `avaliador@demo.ncc` |
| Membro | `membro@demo.ncc` |

### Guião de demonstração (≈5 min)

1. **Investidora → Painel**: próxima acção de cada desafio, submissões por desafio, pipeline e decisões recentes.
2. Abrir *Finanças simples para independentes* → **Submissões** (ordenáveis) → **Comparar** → avaliar a *Conta Fácil*.
3. **Resultados**: confirmar posições, prémios e justificações → **Publicar resultados** (diálogo de confirmação). Cria anúncio, entrega feedback, atribui pontos de mérito.
4. **Pipeline**: investimento separado dos prémios (o 2.º lugar de logística está em *Interesse*).
5. **Novo desafio** → publicar → ver como membro.
6. **Membro**: tarefas pendentes → submeter a Voltaica à *IA para o pequeno comércio*.
7. **Avaliadora**: vê só as suas notas; nunca as dos colegas nem resultados antes da publicação.

## Scripts

| Comando | O quê |
|---|---|
| `npm run dev` / `build` / `start` | desenvolvimento / build de produção / servidor |
| `npm run db:generate` | gerar migração a partir de `src/db/schema.ts` |
| `npm run db:migrate` | aplicar migrações (idempotente, com lock) |
| `npm run db:seed` | carregar demonstração (recusa em `APP_ENV=production`) |
| `npm run db:export -- --out f.json` | exportação portável com checksums |
| `npm run db:import -- f.json` | restaurar numa base vazia e verificar |
| `npm run db:verify -- f.json` | comparar base viva com exportação |
| `npm run supabase:bootstrap` | criar o bucket privado no Supabase |

## Testes

```bash
npm run lint && npm run typecheck
npm test                                                   # unitários + integração (PGlite)
TEST_DATABASE_URL=postgres://…/ncc_test npm test           # os mesmos contra PostgreSQL real
E2E_DATABASE_URL=postgres://…/ncc_e2e npm run test:e2e     # build + Playwright (desktop e telemóvel)
```

Resiliência (reinício da aplicação e paragem da base de dados) — precisa de um Postgres que o teste possa parar: definir `E2E_RESILIENCE_DATABASE_URL`, `E2E_PG_STOP_CMD`, `E2E_PG_START_CMD` (ver `e2e/resilience.spec.ts`).

CI (`.github/workflows/ci.yml`): lint, tipos, testes em PGlite e PostgreSQL 16, migrações numa base limpa (2×), exportação → restauro → verificação, E2E. Backups diários com teste de restauro: `.github/workflows/backup.yml`.

## Estado

**Funcional e testado:** ciclo completo de desafios (criar, editar, publicar, pausar, encerrar, reabrir), critérios ponderados, prémios, inscrição e submissão, atribuição de avaliadores, avaliação confidencial, comparação, confirmação com justificação, publicação com anúncio, histórico de decisões, pipeline de investimento, projectos com equipa, logótipo e actualizações, perfis com fotografia, comunidade, classificações (geral, semanal, mérito, participação, por desafio), cursos, recuperação de palavra-passe.

**Infra-estrutura:** PostgreSQL (Supabase ou outro) via Drizzle; Auth e Storage atrás de interfaces próprias com implementações local e Supabase; exportação/restauro verificáveis; health check; logs estruturados; Docker para alojamento fora da Vercel.

**Pendente de acções externas:** criação do projecto Supabase e do projecto Vercel, variáveis de ambiente e secrets de backup (ver `docs/OPERATIONS.md` §2 e §4). O adaptador Supabase Auth/Storage foi testado contra uma simulação da API HTTP, não contra um projecto real.
