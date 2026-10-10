import { deflateSync } from "node:zlib";
import { expect, type Browser, type BrowserContextOptions, type Locator, type Page } from "@playwright/test";

export async function loginAs(browser: Browser, email: string, options?: BrowserContextOptions): Promise<Page> {
  const ctx = await browser.newContext(options);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());
  await page.goto("/login");
  await page.locator(`form:has(input[value="${email}"]) button`).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

export const INVESTOR = "investidor@demo.ncc";
export const MEMBER = "membro@demo.ncc";
export const EVALUATOR = "avaliador@demo.ncc";

/** Opens the composer on Início and publishes a post; returns the composer for further checks. */
export async function publish(page: Page, post: { title?: string; body: string; kind?: "Conversa" | "Pergunta" | "Progresso" | "Anúncio oficial"; photos?: { name: string; mimeType: string; buffer: Buffer }[] }) {
  await page.getByRole("button", { name: "Escreva algo…" }).click();
  const composer = page.locator("#publicar");
  if (post.kind) await composer.locator("label", { hasText: post.kind }).click();
  if (post.title) await composer.getByLabel("Título (opcional)").fill(post.title);
  await composer.getByLabel("Texto da publicação").fill(post.body);
  if (post.photos) {
    await composer.locator('input[type="file"]').setInputFiles(post.photos);
    await expect(composer.getByRole("img", { name: `Fotografia ${post.photos.length}` })).toBeVisible();
  }
  await composer.getByRole("button", { name: "Publicar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Escreva algo…" })).toBeVisible();
}

/** A post in the feed, found by a link to it (its title). */
export const postCard = (page: Page, title: string) => page.locator("article", { has: page.getByRole("link", { name: title }) });

/** Runs an action from a post's "⋯" menu. */
export async function postMenu(card: Locator, item: string) {
  await card.getByRole("button", { name: "Mais acções" }).click();
  await card.page().getByRole("menuitem", { name: item }).click();
}

/** A real, decodable PNG (solid colour) for upload tests. */
export function png(width: number, height: number, rgb: [number, number, number] = [200, 230, 70]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
