import { expect, test } from "@playwright/test";
import { loginAs, MEMBER } from "./helpers";

/** Tablets in both orientations, a small laptop and a desktop: no sideways scroll, a readable feed, the side column only when it fits. */
const SCREENS = [
  { name: "tablet vertical", width: 768, height: 1024, rail: false },
  { name: "tablet vertical largo", width: 820, height: 1180, rail: false },
  { name: "tablet horizontal", width: 1024, height: 768, rail: true },
  { name: "portátil", width: 1280, height: 800, rail: true },
  { name: "computador", width: 1440, height: 900, rail: true },
];

for (const s of SCREENS) {
  test(`Início on ${s.name} (${s.width}×${s.height})`, async ({ browser }) => {
    const page = await loginAs(browser, MEMBER, { viewport: { width: s.width, height: s.height }, hasTouch: s.width < 1280 });
    await page.goto("/dashboard");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow").toBeLessThanOrEqual(0);
    await expect(page.locator("article").first()).toBeVisible();
    const feed = await page.locator("article").first().boundingBox();
    expect(feed!.width, "feed column too wide to read comfortably").toBeLessThanOrEqual(690);
    await expect(page.getByRole("complementary", { name: "Na comunidade" })).toBeVisible({ visible: s.rail });
    // Writing is the first thing on every screen.
    await expect(page.getByRole("button", { name: "Escreva algo…" })).toBeVisible();
  });
}
