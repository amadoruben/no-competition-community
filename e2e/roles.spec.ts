import { expect, test } from "@playwright/test";
import { EVALUATOR, INVESTOR, MEMBER, loginAs } from "./helpers";

test("evaluator: sees only assigned work, scores it, cannot reach investor areas", async ({ browser }) => {
  const ev = await loginAs(browser, EVALUATOR);
  await expect(ev).toHaveURL(/\/review$/);
  await expect(ev.getByRole("heading", { name: "As suas avaliações" })).toBeVisible();
  // Not assigned to "IA para o pequeno comércio" in the demo data.
  await expect(ev.getByRole("link", { name: /IA para o pequeno comércio/ })).toHaveCount(0);

  await ev.getByRole("link", { name: /Energia acessível para PME/ }).click();
  await ev.getByRole("link", { name: "Avaliar" }).first().click();
  await expect(ev.getByRole("radiogroup")).toHaveCount(4);
  for (const g of await ev.getByRole("radiogroup").all()) await g.getByRole("radio", { name: "7", exact: true }).click();
  await ev.getByRole("button", { name: "Guardar avaliação" }).click();
  await expect(ev.getByText("Avaliação guardada · nota 70/100")).toBeVisible();
  // Colleagues' evaluations are never shown to an evaluator.
  await expect(ev.getByText("Todas as avaliações")).toHaveCount(0);

  for (const path of ["/admin", "/admin/opportunities", "/admin/challenges/new", "/admin/videos", "/admin/people"]) {
    await ev.goto(path);
    await expect(ev).toHaveURL(/\/review$/);
  }
});

test("member: no access to evaluation or investor pages", async ({ browser }) => {
  const inv = await loginAs(browser, INVESTOR);
  await inv.goto("/admin");
  await inv.getByRole("link", { name: /Finanças simples para independentes/ }).first().click();
  await inv.getByRole("link", { name: /^Submissões/ }).click();
  const evaluateHref = await inv.getByRole("link", { name: /Avaliar|Rever/ }).first().getAttribute("href");

  const mem = await loginAs(browser, MEMBER);
  await mem.goto(evaluateHref!);
  await expect(mem).toHaveURL(/\/dashboard/);
  await mem.goto("/admin/opportunities");
  await expect(mem).toHaveURL(/\/dashboard/);
  await mem.goto("/review");
  await expect(mem).toHaveURL(/\/dashboard/);
  for (const path of ["/admin/videos", "/admin/people", "/admin/challenges/new"]) {
    await mem.goto(path);
    await expect(mem).toHaveURL(/\/dashboard/);
  }
  // No management entry points in a member's navigation.
  await expect(mem.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: /Gerir vídeos|Membros e acessos|Pipeline/ })).toHaveCount(0);
});

test("signed-out visitors are sent to login; files require a session", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  const res = await request.get("/files/00000000-0000-0000-0000-000000000000");
  expect(res.status()).toBe(401);
});

test("member uploads a profile photo that persists", async ({ browser }) => {
  const mem = await loginAs(browser, MEMBER);
  await mem.goto("/settings");
  // 1×1 PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  await mem.locator('input[type="file"]').setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
  await mem.getByRole("button", { name: "Guardar imagem" }).click();
  await expect(mem.getByText("Fotografia actualizada.")).toBeVisible();
  await mem.reload();
  const src = await mem.locator('img[src^="/files/"]').first().getAttribute("src");
  expect(src).toMatch(/^\/files\/[0-9a-f-]{36}$/);
  const file = await mem.request.get(src!);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toBe("image/png");
});
