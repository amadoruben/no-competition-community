import { expect, test } from "@playwright/test";
import { INVESTOR, loginAs, MEMBER, publish } from "./helpers";

const TITLE = `Desafio E2E ${Date.now().toString(36)}`;

test("full challenge lifecycle: create → publish → submit → evaluate → publish results", async ({ browser }) => {
  // Investor creates and publishes a challenge.
  const inv = await loginAs(browser, INVESTOR);
  await expect(inv).toHaveURL(/\/admin$/);
  await inv.getByRole("link", { name: "Novo desafio" }).first().click();
  await inv.locator('input[name="title"]').fill(TITLE);
  await inv.locator('input[name="category"]').fill("Teste");
  await inv.locator('input[name="tagline"]').fill("Um desafio criado pelo teste ponta-a-ponta.");
  await inv.locator('textarea[name="description"]').fill("Descrição completa do desafio criado automaticamente.");
  await inv.locator('textarea[name="objectives"]').fill("Validar o fluxo completo");
  // Open for submissions immediately.
  const d = new Date(Date.now() - 36e5);
  const p = (n: number) => String(n).padStart(2, "0");
  await inv.locator('input[name="startsAt"]').fill(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
  await inv.getByRole("button", { name: "Criar rascunho" }).click();
  await expect(inv.getByText("Rascunho criado")).toBeVisible();
  await inv.getByRole("button", { name: "Publicar" }).click();
  await inv.getByRole("dialog").getByRole("button", { name: "Publicar" }).click();
  await expect(inv.getByText("Desafio publicado.")).toBeVisible();
  const adminUrl = inv.url().split("?")[0];

  // Member discovers, enrols and submits.
  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/challenges");
  await mem.getByRole("link", { name: new RegExp(TITLE) }).click();
  await mem.getByRole("button", { name: "Inscrever-me no desafio" }).click();
  await expect(mem.getByText("Inscrição confirmada. Bom trabalho!")).toBeVisible();
  await expect(mem.getByRole("heading", { name: "Está inscrito(a)" })).toBeVisible();
  await mem.getByRole("link", { name: "Submeter projecto" }).click();
  await mem.locator('select[name="projectId"]').selectOption({ label: "Voltaica" });
  await mem.locator('textarea[name="summary"]').fill("Gestão de energia para PME com poupança verificada de 18% em três pilotos.");
  await mem.locator('input[name="deliverableUrl"]').fill("https://demo.voltaica.example.com");
  await mem.getByRole("button", { name: "Submeter projecto" }).click();
  await expect(mem.getByText("Submissão entregue")).toBeVisible();
  const challengeUrl = mem.url().split("?")[0];

  // Member cannot reach the investor panel.
  await mem.goto("/admin");
  await expect(mem).toHaveURL(/\/dashboard/);

  // Investor closes, evaluates, confirms and publishes.
  await inv.goto(adminUrl);
  await inv.getByRole("button", { name: "Encerrar submissões" }).click();
  await inv.getByRole("dialog").getByRole("button", { name: "Encerrar submissões" }).click();
  await expect(inv.getByText("Submissões encerradas.").first()).toBeVisible();
  await inv.goto(`${adminUrl}?tab=submissions`);
  await inv.getByRole("link", { name: "Avaliar" }).first().click();
  await expect(inv.getByRole("radiogroup")).toHaveCount(4);
  for (const group of await inv.getByRole("radiogroup").all()) await group.getByRole("radio", { name: "8", exact: true }).click();
  await inv.locator('textarea[name="feedback"]').fill("Excelente demonstração de impacto.");
  await inv.getByRole("button", { name: "Guardar avaliação" }).click();
  await expect(inv.getByText("Avaliação guardada · nota 80/100")).toBeVisible();

  await inv.goto(`${adminUrl}?tab=results`);
  await inv.getByRole("button", { name: "Confirmar resultados" }).click();
  await expect(inv.getByText("Resultados confirmados.")).toBeVisible();
  // Still private to members.
  await mem.goto(challengeUrl);
  await expect(mem.getByRole("link", { name: "Resultados" })).toHaveCount(0);

  await inv.getByRole("button", { name: "Publicar resultados" }).click();
  await inv.getByRole("dialog").getByRole("button", { name: "Publicar resultados" }).click();
  await expect(inv.getByText("Resultados publicados e anunciados à comunidade.")).toBeVisible();
  await expect(inv.getByText(/Resultados publicados a /)).toBeVisible();

  // Member sees the placement and the feedback; the community sees the announcement.
  await mem.goto(challengeUrl);
  await expect(mem.getByText("1.º lugar").first()).toBeVisible();
  await expect(mem.getByText("Excelente demonstração de impacto.")).toBeVisible();
  await mem.goto("/community?f=announcement");
  await expect(mem.getByText(`Resultados: ${TITLE}`).first()).toBeVisible();
  await mem.goto("/leaderboard?v=merit");
  await expect(mem.getByText("Ana Ribeiro (você)")).toBeVisible();
});

test("validation errors keep the user's input", async ({ browser }) => {
  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/projects/new");
  await mem.locator('input[name="name"]').fill("X");
  await mem.locator('input[name="tagline"]').fill("curta");
  await mem.getByRole("button", { name: "Criar projecto" }).click();
  await expect(mem.getByText("Reveja os campos assinalados.")).toBeVisible();
  await expect(mem.getByText("Nome: mínimo 2 caracteres.")).toBeVisible();
  await expect(mem.locator('input[name="tagline"]')).toHaveValue("curta");
});

test("community: post, comment and react", async ({ browser }) => {
  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/community");
  await publish(mem, { kind: "Pergunta", title: "Pergunta de teste E2E", body: "Alguém tem experiência com tarifas bi-horárias?" });
  await mem.getByRole("link", { name: "Pergunta de teste E2E" }).first().click();
  await expect(mem).toHaveURL(/\/community\//);
  await mem.getByLabel("Escrever um comentário").fill("Comentário de teste.");
  await mem.getByRole("button", { name: "Comentar" }).click();
  await expect(mem.getByRole("heading", { name: "1 comentário" })).toBeVisible();
  await mem.getByRole("button", { name: "Gosto" }).click();
  await expect(mem.locator('button[aria-pressed="true"]')).toBeVisible();
});
