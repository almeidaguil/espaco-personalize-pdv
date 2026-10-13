import { expect, test } from "@playwright/test";
import { authenticatePage } from "./support/auth";
import {
  closeOwnOpenCashSession,
  openCashSessionThroughUi,
} from "./support/cash";

test.beforeEach(async ({ page }) => {
  await authenticatePage(page);
  await closeOwnOpenCashSession();
});

test.afterEach(async () => {
  await closeOwnOpenCashSession();
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

  const session = await openCashSessionThroughUi(page, "admin", "150,50");

  await page.goto("/pdv");
  await expect(
    page.getByRole("heading", { name: "Caixa aberto para venda" }),
  ).toBeVisible();
  await expect(
    page.getByText(`Sessao #${session.id.slice(0, 8)}`),
  ).toBeVisible();
  await expect(page.getByLabel("Caixa da venda")).toHaveCount(0);

  await page.goto("/cash/open");
  await page.getByLabel("Valor inicial").fill("10,00");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(
    page.getByText("Ja existe um caixa aberto para este operador."),
  ).toBeVisible();
});
