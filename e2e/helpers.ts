import type { Browser, Page } from "@playwright/test";

export async function loginAs(browser: Browser, email: string): Promise<Page> {
  const ctx = await browser.newContext();
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
