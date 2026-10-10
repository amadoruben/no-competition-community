import { expect, test } from "@playwright/test";
import { INVESTOR, loginAs, MEMBER } from "./helpers";

const memberPages = ["/dashboard", "/challenges", "/challenges/energia-acessivel-pme", "/projects/voltaica", "/community", "/leaderboard", "/learn"];

test("member pages fit a phone screen", async ({ browser }) => {
  const page = await loginAs(browser, MEMBER);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of memberPages) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

test("investor panel fits a phone screen", async ({ browser }) => {
  const page = await loginAs(browser, INVESTOR);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/admin", "/admin/opportunities", "/admin/challenges/new"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});
