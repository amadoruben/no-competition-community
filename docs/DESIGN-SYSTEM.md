# Design system

Referência viva: **`/design`** na aplicação (com sessão iniciada) — tudo o que lá aparece é o componente de produção.

## Princípios

1. **Tinta sobre papel, um acento.** Fundo quente, texto quase preto; o *volt* (#d4f24a) marca só a acção principal e o que é "agora" (inscrições abertas, posição do utilizador).
2. **Informação antes de decoração.** Capas geradas a partir de um matiz (sem imagens de banco); gráficos só onde respondem a uma pergunta.
3. **Nunca só cor.** Estados têm texto; notas têm número; ordenação é anunciada.
4. **Acções irreversíveis pedem confirmação** num diálogo que explica as consequências.
5. **Honestidade de estado.** Sucesso só depois de guardado; falhas dizem o que (não) aconteceu.

## Tokens (`src/app/globals.css`)

| Grupo | Tokens |
|---|---|
| Superfícies | `paper` #f6f5f0 · `surface` #fff · `sunken` #efede6 · `line` #e3e0d6 · `line-strong` #cfcbbf |
| Texto | `ink` #101216 (17:1) · `ink-2` #383d45 (10:1) · `muted` #62666e (≥4.9:1 em todas as superfícies) · `faint` #868a92 (só decorativo) |
| Acento | `volt` #d4f24a · `volt-strong` #b9dc1d · `volt-soft` #f1fbcc |
| Estado | `ok` #17704d · `warn` #a2500a · `bad` #b42339 · `info` #2846c2 · `violet` #6d3fc0, cada um com `*-soft` (texto sobre soft ≥5:1) |
| Tipografia | Display: Bricolage Grotesque · UI: Geist · Números: Geist Mono (`tabular`) |
| Raios | cartões 14px (`--radius-card`), controlos 12px, pills 999px |
| Elevação | `--shadow-card` (repouso) · `--shadow-pop` (hover, menus, diálogos) |
| Grelha | contentor 1200px; gutters 16px (telemóvel) / 24px; 1 → 2 → 3 colunas |

Contrastes calculados (WCAG 2.1): ver a secção *Cores* em `/design`.

## Componentes

| Categoria | Componentes | Ficheiro |
|---|---|---|
| Acções | `Button`, `ButtonLink`, `buttonClass` (primary, accent, secondary, ghost, danger; sm/md/lg) | `components/ui.tsx` |
| Formulários | `ActionForm` (sem reset em erro, erros por campo, foco no 1.º erro), `Field`, `Input`, `Textarea`, `Select`, `SubmitButton`, `Switch`, `ImageUpload` | `form.tsx`, `overlay.tsx`, `image-upload.tsx` |
| Superfícies | `Card`, `CardHeader`, `PageHeader`, `ChallengeCover` | `ui.tsx` |
| Identidade | `Avatar`, `ProjectLogo` (imagem carregada ou monograma gerado), `Brand` | `ui.tsx`, `brand.tsx` |
| Navegação | `AppNav` (tabs ≥768px), `MobileNav` (gaveta <768px), `Breadcrumbs`, `Tabs`, `FilterChips`, `Pagination`, `SearchBox`, `UserMenu`, link "Saltar para o conteúdo" | `app-nav.tsx`, `ui.tsx`, `user-menu.tsx` |
| Sobreposições | `Dialog` (nativo `<dialog>`), `ConfirmSubmit`, `Drawer`, `Tooltip`, `Toaster`/`toast()` | `overlay.tsx`, `toaster.tsx` |
| Dados | `SortHeader` (`aria-sort`), `BarList` (gráfico de barras de uma série), `Progress`, `Stat` | `ui.tsx` |
| Estados | `EmptyState`, `Skeleton` + `loading.tsx`, `Notice`, `StatePanel`, `ErrorState` (consulta `/api/health`), `not-found.tsx`, `global-error.tsx` | `ui.tsx`, `error-state.tsx` |
| Domínio | `ChallengeCard`, `PhaseBadge`, `StageBadge`, `ProjectCard`, `PersonLine`, `PostCard`, `PostRow`, `ReactionButton`, `ScorePill`, `RankMedal`, `RoleTag`, `ScoreForm`, `ChallengeEditor`, `ResultsForm` | `domain.tsx`, páginas |

## Gráficos

`BarList`: uma série, uma cor (ink), valores sempre em texto, escala fixa quando comparável (`max`), título nomeia a série (sem legenda), tooltip nativo com o valor exacto, exposto como lista. Sem eixos duplos, sem arco-íris, cores de estado nunca usadas como séries.

## Acessibilidade

- Foco visível (contorno ink 2px) em todos os interactivos; ordem de tabulação lógica.
- Diálogos nativos: foco movido e devolvido, `Esc` fecha, conteúdo atrás inerte.
- Formulários: rótulos visíveis, erros por campo ligados por `aria-describedby`, `aria-invalid`.
- Tabelas ordenáveis com `aria-sort`; listas e navegação com `aria-current`.
- Alvos de toque ≥32px; sem dependência de hover para informação (tooltips também no foco).
- Toasts em região `aria-live`; erros com `role="alert"`.

## Responsividade

Testada automaticamente (Playwright, 390px): nenhuma página principal tem scroll horizontal. Tabelas largas fazem scroll dentro do próprio cartão. Navegação principal passa a gaveta abaixo de 768px.

## Regras de uso

- Uma acção `accent` por ecrã.
- Texto de estado em português claro, com o que aconteceu e o próximo passo.
- Números com `tabular`; datas com `fmtDate`/`fmtDateTime` (formato pt-PT explícito).
- Novos componentes entram em `/design` no mesmo commit.
