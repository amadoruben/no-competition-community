import { expect, test } from "@playwright/test";
import { INVESTOR, loginAs, MEMBER, png, postCard, postMenu, publish } from "./helpers";

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
  await publish(mem, { title, body: "Sou novo por aqui e estou a construir um projecto de energia." });
  await expect(mem.getByRole("link", { name: title })).toBeVisible();

  // On a computer the profile is in the account menu (the photo at the top right).
  await mem.getByRole("button", { name: /^Conta de / }).click();
  await mem.getByRole("menuitem", { name: "O meu perfil" }).click();
  await expect(mem.getByRole("link", { name: "Editar perfil" })).toBeVisible();
  await expect(mem.getByRole("link", { name: title })).toBeVisible();

  const inv = await loginAs(browser, INVESTOR);
  await inv.goto("/dashboard");
  await postMenu(postCard(inv, title), "Remover publicação");
  await inv.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(inv.getByRole("link", { name: title })).toHaveCount(0);

  await mem.goto("/dashboard");
  await expect(mem.getByRole("link", { name: title })).toHaveCount(0);
});

test("first content: the admin's welcome announcement is pinned and official for members", async ({ browser }) => {
  const title = `Bem-vindos à comunidade ${Date.now()}`;
  const inv = await loginAs(browser, INVESTOR);
  await inv.goto("/dashboard");
  await publish(inv, { kind: "Anúncio oficial", title, body: "Esta é a comunidade oficial da No Competition." });
  await expect(inv.getByRole("link", { name: title })).toBeVisible();

  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/dashboard?f=announcement");
  const card = postCard(mem, title);
  await expect(card).toBeVisible();
  await expect(card.getByRole("img", { name: "Conta oficial No Competition" })).toBeVisible();
  await expect(card.getByText("Anúncio oficial", { exact: true })).toBeVisible();
  await expect(card.getByText("Fixado", { exact: true })).toBeVisible();
  // Pinned: first in the community feed.
  await mem.goto("/dashboard");
  await expect(mem.locator("article").first()).toHaveAccessibleName(title);
  // Members never get the "official announcement" option, nor moderation.
  await mem.getByRole("button", { name: "Escreva algo…" }).click();
  await expect(mem.locator("#publicar").getByRole("radio", { name: "Anúncio oficial" })).toHaveCount(0);
  await postCard(mem, title).getByRole("button", { name: "Mais acções" }).click();
  await expect(mem.getByRole("menuitem", { name: "Remover publicação" })).toHaveCount(0);
  await expect(mem.getByRole("menuitem", { name: "Copiar link" })).toBeVisible();

  await inv.goto("/dashboard");
  await postMenu(postCard(inv, title), "Remover publicação");
  await inv.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(inv.getByRole("link", { name: title })).toHaveCount(0);
});

test("feed: photos, reactions, saved posts and replies persist", async ({ browser }) => {
  const title = `Primeiro protótipo ${Date.now()}`;
  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/dashboard");
  await publish(mem, {
    title,
    kind: "Progresso",
    body: "Montámos o sensor na loja piloto. Mais em https://example.com/piloto",
    photos: [
      { name: "a.png", mimeType: "image/png", buffer: png(120, 150) },
      { name: "b.png", mimeType: "image/png", buffer: png(160, 90, [40, 40, 40]) },
    ],
  });
  // The feed row shows a thumbnail; the photos themselves are on the post page.
  await expect(postCard(mem, title).locator('img[src^="/files/"]')).toHaveCount(1);
  await postCard(mem, title).getByRole("link", { name: title }).click();
  await expect(mem).toHaveURL(/\/community\//);
  const card = mem.locator("article").first();
  await expect(card.getByRole("group", { name: /2 fotografias/ })).toBeVisible();
  // The photos are served (signed-in only) and decode in the browser.
  const first = card.getByRole("img", { name: /fotografia 1 de 2/ });
  await expect(first).toHaveAttribute("src", /^\/files\//);
  await expect.poll(() => first.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
  await expect(card.getByRole("link", { name: "example.com/piloto" })).toHaveAttribute("rel", /noopener/);

  // React and save, then reload: both persist.
  const other = await loginAs(browser, INVESTOR);
  await other.goto("/dashboard");
  const seen = postCard(other, title);
  await seen.getByRole("button", { name: "Gosto" }).click();
  await expect(seen.getByRole("button", { name: "Retirar gosto" })).toHaveAttribute("aria-pressed", "true");
  await expect(seen.getByRole("button", { name: "Retirar gosto" })).toContainText("1");
  await seen.getByRole("button", { name: "Guardar" }).click();
  await expect(seen.getByRole("button", { name: "Remover dos guardados" })).toBeVisible();
  await other.reload();
  await expect(postCard(other, title).getByRole("button", { name: "Retirar gosto" })).toBeVisible();
  await expect(postCard(other, title).getByRole("button", { name: "Retirar gosto" })).toContainText("1");
  await other.goto("/dashboard?f=saved");
  await expect(postCard(other, title)).toBeVisible();
  // Saved posts are private: the author's saved list does not have it.
  await mem.goto("/dashboard?f=saved");
  await expect(mem.getByRole("link", { name: title })).toHaveCount(0);

  // "Comentar" in the feed opens the conversation; comment there, and the feed row shows who commented.
  await other.goto("/dashboard");
  await postCard(other, title).getByRole("link", { name: "Comentar" }).click();
  await expect(other).toHaveURL(/\/community\/.+#comentar$/);
  await other.getByLabel("Escrever um comentário").fill("Que poupança mediram?");
  await other.getByRole("button", { name: "Comentar" }).click();
  await expect(other.getByText("Que poupança mediram?")).toBeVisible();
  await other.goto("/dashboard");
  await expect(postCard(other, title).getByText(/^Novo comentário/)).toBeVisible();
  await mem.goto("/dashboard");
  await postCard(mem, title).getByRole("link", { name: title }).click();
  await mem.getByRole("button", { name: "Responder" }).click();
  await mem.getByLabel(/Responder a/).fill("Cerca de 18% no primeiro mês.");
  await mem.getByRole("button", { name: "Responder", exact: true }).last().click();
  await expect(mem.getByRole("heading", { name: "2 comentários" })).toBeVisible();
  await mem.reload();
  await expect(mem.getByText("Cerca de 18% no primeiro mês.")).toBeVisible();

  // The author removes the post (and its photos).
  await postMenu(mem.locator("article").first(), "Remover publicação");
  await mem.getByRole("dialog").getByRole("button", { name: "Remover" }).click();
  await expect(mem).toHaveURL(/\/dashboard$/);
  await expect(mem.getByRole("link", { name: title })).toHaveCount(0);
});
