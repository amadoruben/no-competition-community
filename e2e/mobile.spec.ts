import { expect, test } from "@playwright/test";
import { INVESTOR, loginAs, MEMBER } from "./helpers";

const memberPages = ["/dashboard", "/videos", "/challenges", "/challenges/energia-acessivel-pme", "/members", "/profile", "/projects/voltaica", "/leaderboard"];

test("member pages fit a phone screen", async ({ browser }) => {
  const page = await loginAs(browser, MEMBER);
  for (const path of memberPages) {
    await page.goto(path);
    await page.waitForLoadState("networkidle"); // /profile redirects on the client
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - Math.round(window.visualViewport!.width));
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

test("investor panel fits a phone screen", async ({ browser }) => {
  const page = await loginAs(browser, INVESTOR);
  for (const path of ["/admin", "/admin/videos", "/admin/people", "/admin/opportunities", "/admin/challenges/new"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - Math.round(window.visualViewport!.width));
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
});

test("the five main areas are one tap away on a phone", async ({ browser }) => {
  // The project's phone emulation (Pixel 7) as is: resizing an emulated phone leaves fixed elements off-screen.
  const page = await loginAs(browser, MEMBER);
  const tabs = page.getByRole("navigation", { name: "Secções" });
  for (const [label, url] of [["Vídeos", /\/videos$/], ["Desafios", /\/challenges$/], ["Membros", /\/members$/], ["Perfil", /\/members\/[\w-]+$/], ["Início", /\/dashboard$/]] as const) {
    await tabs.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(url);
    await expect(tabs.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});
