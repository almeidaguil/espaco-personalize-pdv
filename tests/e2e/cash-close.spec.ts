import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import {
  authenticatePage,
  createAuthenticatedSupabaseClient,
  getE2EUserCredentials,
} from "./support/auth";
import {
  cashSessionCloseForm,
  closeCashSessionThroughUi,
  closeOwnOpenCashSession,
  openCashSessionThroughUi,
} from "./support/cash";
import { createTestProductWithStock, finalizeSale } from "./support/store";

test.beforeEach(async ({ page }) => {
  await closeOwnOpenCashSession();
  await authenticatePage(page);
});
test.afterEach(async () => {
  await closeOwnOpenCashSession();
});

test("admin closes and reopens a cash session on the same day", async ({
  page,
}) => {
  const first = await openCashSessionThroughUi(page, "admin", "150,50");
  await closeCashSessionThroughUi(page, first.id, {
    cash: "150,50",
    credit_card: "0,00",
    debit_card: "0,00",
    pix: "0,00",
  });
  const second = await openCashSessionThroughUi(page, "admin", "25,00");
  expect(second.id).not.toBe(first.id);
  expect(new Date(second.opened_at).toDateString()).toBe(
    new Date(first.opened_at).toDateString(),
  );
  await closeCashSessionThroughUi(page, second.id, {
    cash: "25,00",
    credit_card: "0,00",
    debit_card: "0,00",
    pix: "0,00",
  });
});

test("cash close requires four counts and authorizes every divergence independently", async ({
  page,
}) => {
  const adminPassword = getE2EUserCredentials("admin").password;
  const surplusSession = await openCashSessionThroughUi(
    page,
    "admin",
    "100,00",
  );
  await page.goto("/cash/close");
  const surplusForm = cashSessionCloseForm(page, surplusSession.id);
  await expect(
    surplusForm.getByRole("button", { name: "Fechar caixa" }),
  ).toBeDisabled();
  await surplusForm.getByLabel("Valor conferido — Dinheiro").fill("110,00");
  await surplusForm.getByLabel("Valor conferido — Pix").fill("0,00");
  await surplusForm
    .getByLabel("Valor conferido — Cartão de crédito")
    .fill("0,00");
  await surplusForm
    .getByLabel("Valor conferido — Cartão de débito")
    .fill("0,00");
  await expect(surplusForm.getByText("Sobra: R$ 10,00")).toBeVisible();
  await surplusForm.getByLabel("Senha administrativa").fill("senha-invalida");
  await surplusForm.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(
    surplusForm.getByText(
      "Informe uma senha administrativa valida para fechar caixa com divergencia.",
    ),
  ).toBeVisible();
  await surplusForm.getByLabel("Senha administrativa").fill(adminPassword);
  await surplusForm.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(
    surplusForm.getByText("Caixa fechado com sucesso.", { exact: true }),
  ).toBeVisible();

  const shortageSession = await openCashSessionThroughUi(
    page,
    "admin",
    "100,00",
  );
  await page.goto("/cash/close");
  const shortageForm = cashSessionCloseForm(page, shortageSession.id);
  await shortageForm.getByLabel("Valor conferido — Dinheiro").fill("90,00");
  await shortageForm.getByLabel("Valor conferido — Pix").fill("0,00");
  await shortageForm
    .getByLabel("Valor conferido — Cartão de crédito")
    .fill("0,00");
  await shortageForm
    .getByLabel("Valor conferido — Cartão de débito")
    .fill("0,00");
  await expect(shortageForm.getByText("Falta: R$ 10,00")).toBeVisible();
  await shortageForm.getByLabel("Senha administrativa").fill(adminPassword);
  await shortageForm.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(
    shortageForm.getByText("Caixa fechado com sucesso.", { exact: true }),
  ).toBeVisible();

  const product = await createTestProductWithStock(page, 1);
  const oppositeSession = await openCashSessionThroughUi(
    page,
    "admin",
    "100,00",
  );
  const client = await createAuthenticatedSupabaseClient("admin");
  const sale = await finalizeSale(
    client,
    oppositeSession.id,
    product.productId,
    randomUUID(),
    { payments: [{ amount_in_cents: 1500, method: "pix" }] },
  );
  expect(sale.error).toBeNull();
  await page.goto("/cash/close");
  const oppositeForm = cashSessionCloseForm(page, oppositeSession.id);
  await oppositeForm.getByLabel("Valor conferido — Dinheiro").fill("110,00");
  await oppositeForm.getByLabel("Valor conferido — Pix").fill("5,00");
  await oppositeForm
    .getByLabel("Valor conferido — Cartão de crédito")
    .fill("0,00");
  await oppositeForm
    .getByLabel("Valor conferido — Cartão de débito")
    .fill("0,00");
  await expect(oppositeForm.getByText("Sobra: R$ 10,00")).toBeVisible();
  await expect(oppositeForm.getByText("Falta: R$ 10,00")).toBeVisible();
  await oppositeForm.getByLabel("Senha administrativa").fill(adminPassword);
  await oppositeForm.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(
    oppositeForm.getByText("Caixa fechado com sucesso.", { exact: true }),
  ).toBeVisible();
});
