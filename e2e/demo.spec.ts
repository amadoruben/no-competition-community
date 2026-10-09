import { expect, test } from "@playwright/test";

test("guided tour: landing → /demo → step opens the right page as the right role", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explorar a demonstração" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByText("fictícios")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) })).toHaveCount(6);

  // Step 4: evaluator lands directly on their review queue.
  await page.getByRole("listitem").filter({ hasText: "Avaliação confidencial" }).getByRole("button").click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole("heading", { name: "As suas avaliações" })).toBeVisible();
});

test("demo login ignores off-site next targets", async ({ page }) => {
  await page.goto("/demo");
  const form = page.locator("form").filter({ hasText: "Abrir como membro" }).first();
  await form.locator('input[name="next"]').evaluate((el: HTMLInputElement) => (el.value = "/\\evil.example"));
  await form.getByRole("button").click();
  await expect(page).toHaveURL(/^http:\/\/(localhost|127\.0\.0\.1):\d+\/dashboard/);
});
