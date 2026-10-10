import { expect, test } from "@playwright/test";

test("a new member registers, deletes the account, and can no longer sign in", async ({ page }) => {
  const email = `apagar-${Date.now()}@example.test`;
  const password = "uma-palavra-passe-longa";
  await page.goto("/register");
  await page.locator('input[name="name"]').fill("Conta Temporária");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/dashboard/);

  await page.goto("/settings");
  await page.locator('input[name="confirm"]').fill("outro@example.test");
  await page.getByRole("button", { name: "Eliminar a minha conta" }).click();
  await expect(page.getByText("O email não coincide com o da sua conta.")).toBeVisible();

  await page.locator('input[name="confirm"]').fill(email);
  await page.getByRole("button", { name: "Eliminar a minha conta" }).click();
  await page.waitForURL(/\/login\?deleted=1/);
  await expect(page.getByText("A sua conta foi eliminada.")).toBeVisible();

  await page.locator('input#email[type="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Email ou palavra-passe incorrectos.")).toBeVisible();
});
