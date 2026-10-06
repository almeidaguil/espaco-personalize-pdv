import { expect, type Page, test } from "@playwright/test";

import { authenticatePage, hasAuthenticatedE2EConfig } from "./support/auth";

test.skip(
  !hasAuthenticatedE2EConfig(),
  "E2E auth and Supabase public env vars are required for authenticated E2E tests.",
);

test.beforeEach(async ({ page }) => {
  await authenticatePage(page);
  await closeOwnOpenCashSession(page);
});

test.afterEach(async ({ page }) => {
  await closeOwnOpenCashSession(page);
});

test("admin opens one cash session and the PDV uses it automatically", async ({
  page,
}) => {
  await page.goto("/pdv");
  await expect(
    page.getByRole("heading", { name: "Abra o caixa antes de vender" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finalizar venda" }),
  ).toHaveCount(0);

  await page.goto("/cash/open");
  await page.getByLabel("Valor inicial").fill("150,50");
  await page.getByRole("button", { name: "Abrir caixa" }).click();

  await expect(page.getByText("Caixa aberto com sucesso.")).toBeVisible();

  await page.goto("/pdv");
  await expect(
    page.getByRole("heading", { name: "Caixa aberto para venda" }),
  ).toBeVisible();
  await expect(page.getByText("Sessao #")).toBeVisible();
  await expect(page.getByLabel("Caixa da venda")).toHaveCount(0);

  await page.goto("/cash/open");
  await page.getByLabel("Valor inicial").fill("10,00");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(
    page.getByText("Ja existe um caixa aberto para este operador."),
  ).toBeVisible();
});

async function closeOwnOpenCashSession(page: Page) {
  await page.goto("/cash/close");

  const closeButton = page.getByRole("button", { name: "Fechar caixa" });

  if ((await closeButton.count()) === 0) {
    return;
  }

  await page.getByLabel("Valor contado no caixa").fill("999999,00");
  await closeButton.click();
  await expect(page.getByText("Caixa fechado com sucesso.")).toBeVisible();
  await page.goto("/cash/close");
  await expect(closeButton).toHaveCount(0);
}
