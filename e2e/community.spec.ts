import { expect, test } from "@playwright/test";
import { INVESTOR, loginAs, MEMBER } from "./helpers";

const COLLECTION = `Bastidores E2E ${Date.now()}`;
const VIDEO = "Episódio exclusivo E2E";

test("exclusive videos: locked for members until the admin grants full access", async ({ browser }) => {
  const inv = await loginAs(browser, INVESTOR);
  await inv.goto("/admin/videos");
  await inv.locator("#c-title").fill(COLLECTION);
  await inv.locator("#c-description").fill("Conteúdo só para membros com acesso completo.");
  await inv.locator("#c-access").selectOption("full");
  await inv.getByRole("button", { name: "Criar colecção" }).click();
  await expect(inv.getByRole("link", { name: COLLECTION })).toBeVisible();

  await inv.locator("#v-course").selectOption({ label: COLLECTION });
  await inv.locator("#v-title").fill(VIDEO);
  await inv.locator("#v-url").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await inv.getByRole("button", { name: "Publicar vídeo" }).click();
  await expect(inv.getByRole("link", { name: VIDEO })).toBeVisible();

  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/videos");
  await mem.getByRole("link", { name: new RegExp(COLLECTION) }).click();
  await expect(mem.getByText(/Este conteúdo é exclusivo/)).toBeVisible();
  await expect(mem.getByRole("link", { name: VIDEO })).toHaveCount(0);
  await expect(mem.locator("iframe")).toHaveCount(0);
  // Direct link to the video goes back to the locked collection.
  const slug = mem.url().split("/videos/")[1];
  await mem.goto(`/videos/${slug}/episodio-exclusivo-e2e`);
  await expect(mem).toHaveURL(new RegExp(`/videos/${slug}$`));

  await inv.goto("/admin/people?q=membro%40demo.ncc");
  await inv.getByRole("button", { name: "Dar acesso completo" }).click();
  await expect(inv.getByRole("button", { name: "Retirar acesso completo" })).toBeVisible();

  await mem.goto(`/videos/${slug}`);
  await mem.getByRole("link", { name: VIDEO }).click();
  await expect(mem.locator('iframe[src^="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"]')).toBeVisible();
  await mem.getByRole("button", { name: "Marcar como visto" }).click();
  await expect(mem.getByRole("button", { name: /Visto/ })).toBeVisible();

  // Leave the demo member as it was.
  await inv.getByRole("button", { name: "Retirar acesso completo" }).click();
  await expect(inv.getByRole("button", { name: "Dar acesso completo" })).toBeVisible();
});

test("Início: members post, the admin moderates, the profile shows the activity", async ({ browser }) => {
  const title = `Olá comunidade ${Date.now()}`;
  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/dashboard");
  await mem.getByRole("button", { name: /Escreva algo para a comunidade/ }).click();
  await mem.getByLabel("Título").fill(title);
  await mem.getByLabel("Texto").fill("Sou novo por aqui e estou a construir um projecto de energia.");
  await mem.getByRole("button", { name: "Publicar" }).click();
  await expect(mem.getByRole("link", { name: title })).toBeVisible();

  await mem.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Perfil" }).click();
  await expect(mem.getByText("A sua conta")).toBeVisible();
  await expect(mem.getByRole("link", { name: title })).toBeVisible();

  const inv = await loginAs(browser, INVESTOR);
  await inv.goto("/dashboard");
  const card = inv.locator("article", { has: inv.getByRole("link", { name: title }) });
  await card.getByRole("button", { name: "Remover publicação" }).click();
  await inv.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(inv.getByRole("link", { name: title })).toHaveCount(0);

  await mem.goto("/dashboard");
  await expect(mem.getByRole("link", { name: title })).toHaveCount(0);
});

test("first content: the admin's welcome announcement is pinned and official for members", async ({ browser }) => {
  const title = `Bem-vindos à comunidade ${Date.now()}`;
  const inv = await loginAs(browser, INVESTOR);
  await inv.goto("/dashboard");
  await inv.getByRole("button", { name: /Escreva algo para a comunidade/ }).click();
  await inv.getByLabel("Tipo").selectOption("announcement");
  await inv.getByLabel("Título").fill(title);
  await inv.getByLabel("Texto").fill("Esta é a comunidade oficial da No Competition.");
  await inv.getByRole("button", { name: "Publicar" }).click();
  await expect(inv.getByRole("link", { name: title })).toBeVisible();

  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/dashboard?f=announcement");
  const first = mem.getByRole("link", { name: title });
  await expect(first).toBeVisible();
  const card = mem.locator("article", { has: first });
  await expect(card.getByText("No Competition", { exact: true })).toBeVisible();
  await expect(card.getByText("Fixado")).toBeVisible();
  // Members never get the "official announcement" option.
  await mem.getByRole("button", { name: /Escreva algo para a comunidade/ }).click();
  await expect(mem.getByLabel("Tipo").locator('option[value="announcement"]')).toHaveCount(0);

  await inv.goto("/dashboard");
  const own = inv.locator("article", { has: inv.getByRole("link", { name: title }) });
  await own.getByRole("button", { name: "Remover publicação" }).click();
  await inv.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(inv.getByRole("link", { name: title })).toHaveCount(0);
});
