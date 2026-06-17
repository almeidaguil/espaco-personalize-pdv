import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import { createBrowserClient } from "@supabase/ssr";

const e2eUserEmail = process.env.E2E_USER_EMAIL;
const e2eUserPassword = process.env.E2E_USER_PASSWORD;
const e2eBaseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const publicEnv = getPublicEnv();

test.skip(
  !e2eUserEmail ||
    !e2eUserPassword ||
    !publicEnv.NEXT_PUBLIC_SUPABASE_URL ||
    !publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  "E2E auth and Supabase public env vars are required for authenticated E2E tests.",
);

test("admin creates and cancels a sale restoring stock", async ({ page }) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Venda E2E Produto ${uniqueSuffix}`;
  const productSku = `VENDA-E2E-${uniqueSuffix.slice(0, 8)}`;

  await authenticatePage(page);
  await closeAllOpenCashSessions(page);
  await createProduct(page, productName, productSku);
  await addInitialStock(page, productName, 3);
  const eventName = await openCashSession(page);
  await createSale(page, productName, eventName, {
    receivedAmount: "20,00",
  });
  await cancelSale(page, eventName);

  await page.goto("/stock");
  const balanceItem = page
    .locator("article", { hasText: productName })
    .filter({ hasText: "3" })
    .first();

  await expect(balanceItem).toBeVisible();
  await expect(
    page
      .locator("article", { hasText: productName })
      .filter({ hasText: "Cancelamento de venda" })
      .first(),
  ).toBeVisible();

  await closeAllOpenCashSessions(page);
});

test("admin records non-cash sales and closes cash with reconciliation", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Pagamento E2E Produto ${uniqueSuffix}`;
  const productSku = `PAG-E2E-${uniqueSuffix.slice(0, 8)}`;

  await authenticatePage(page);
  await closeAllOpenCashSessions(page);
  await createProduct(page, productName, productSku);
  await addInitialStock(page, productName, 4);
  const eventName = await openCashSession(page);

  await createSale(page, productName, eventName, {
    paymentMethodLabel: "Pix",
  });
  await createSale(page, productName, eventName, {
    paymentMethodLabel: "Cartao de credito",
  });

  await page.goto("/cash/close");
  const cashCloseForm = page.locator("form", { hasText: eventName }).first();

  await expect(cashCloseForm).toContainText("2 vendas concluidas");
  await expect(cashCloseForm).toContainText("R$ 100,00");
  await expect(cashCloseForm.getByLabel("Senha administrativa")).toHaveCount(0);

  await cashCloseForm.getByLabel("Valor contado no caixa").fill("100,00");
  await cashCloseForm.getByRole("button", { name: "Fechar caixa" }).click();

  await expect(page.getByText("Caixa fechado com sucesso.")).toBeVisible();
});

async function createProduct(page: Page, productName: string, sku: string) {
  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.locator("#priceInReais").fill("15,00");
  await page.getByLabel("SKU").fill(sku);
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();
}

async function addInitialStock(
  page: Page,
  productName: string,
  quantity: number,
) {
  await page.goto("/stock");

  const productOptionValue = await page
    .locator("select#productId option", { hasText: productName })
    .getAttribute("value");

  expect(productOptionValue).not.toBeNull();

  await page
    .getByLabel("Produto", { exact: true })
    .selectOption(productOptionValue ?? "");
  await page.getByLabel("Quantidade").fill(String(quantity));
  await page.getByRole("button", { name: "Registrar ajuste" }).click();

  await expect(page.getByText("Estoque ajustado com sucesso.")).toBeVisible();
}

async function openCashSession(page: Page) {
  await page.goto("/cash/open");

  const activeEvent = await getFirstSelectableOption(page, "eventId");

  expect(activeEvent).not.toBeNull();

  await page.getByLabel("Evento").selectOption(activeEvent?.value ?? "");
  await page.getByLabel("Valor inicial").fill("100,00");
  await page.getByRole("button", { name: "Abrir caixa" }).click();

  await expect(page.getByText("Caixa aberto com sucesso.")).toBeVisible();

  return getEventNameFromOption(activeEvent?.label ?? "");
}

type CreateSaleOptions = {
  paymentMethodLabel?: "Cartao de credito" | "Cartao de debito" | "Pix";
  receivedAmount?: string;
};

async function createSale(
  page: Page,
  productName: string,
  eventName: string,
  options: CreateSaleOptions = {},
) {
  await page.goto("/pdv");
  await expect(page.getByText(eventName).first()).toBeVisible();

  await page.getByLabel("Buscar produto").fill(productName);
  await page
    .locator("article", { hasText: productName })
    .getByRole("button", { name: "Adicionar" })
    .click();

  if (options.paymentMethodLabel) {
    await page.getByLabel("Forma de pagamento").selectOption({
      label: options.paymentMethodLabel,
    });
    await expect(
      page.getByText(`${options.paymentMethodLabel} no valor de R$ 15,00`),
    ).toBeVisible();
  } else {
    await page
      .getByLabel("Valor recebido")
      .fill(options.receivedAmount ?? "20,00");
    await expect(page.getByText("Troco R$ 5,00")).toBeVisible();
  }

  await page.getByRole("button", { name: "Finalizar venda" }).click();

  await expect(page.getByText("Venda finalizada com sucesso.")).toBeVisible();
}

async function cancelSale(page: Page, eventName: string) {
  await page.goto("/sales");

  const saleItem = page.locator("li", { hasText: eventName }).first();
  await saleItem.getByRole("link", { name: "Ver detalhes" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Detalhe da venda" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: /Confirmo que esta venda deve ser cancelada/,
    })
    .check();
  await page.getByLabel("Senha administrativa").fill("123456");
  await page.getByRole("button", { name: "Cancelar venda" }).click();

  await expect(page.getByText("Venda cancelada com sucesso.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Venda cancelada" }),
  ).toBeDisabled();
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
}

async function authenticatePage(page: Page) {
  const cookieJar = new Map<string, string>();
  const supabase = createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? "",
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      cookies: {
        getAll: () =>
          [...cookieJar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => {
            if (value) {
              cookieJar.set(name, value);
            } else {
              cookieJar.delete(name);
            }
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: e2eUserEmail ?? "",
    password: e2eUserPassword ?? "",
  });

  expect(error).toBeNull();

  await page.context().addCookies(
    [...cookieJar.entries()].map(([name, value]) => ({
      name,
      url: e2eBaseUrl,
      value,
    })),
  );
}

function getPublicEnv() {
  const envFile = readEnvFile(".env.local");

  return {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      envFile.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? envFile.NEXT_PUBLIC_SUPABASE_URL,
  };
}

function readEnvFile(path: string): Record<string, string | undefined> {
  try {
    return Object.fromEntries(
      readFileSync(path, "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const separatorIndex = line.indexOf("=");

          return [
            line.slice(0, separatorIndex),
            line.slice(separatorIndex + 1),
          ];
        }),
    );
  } catch {
    return {};
  }
}

function getEventNameFromOption(label: string) {
  return label.split(" · ")[0]?.split(" Â· ")[0] ?? label;
}

async function getFirstSelectableOption(page: Page, selectId: string) {
  return page.locator(`select#${selectId} option`).evaluateAll((options) => {
    const option = options.find(
      (candidate): candidate is HTMLOptionElement =>
        candidate instanceof HTMLOptionElement && candidate.value !== "",
    );

    return option
      ? { label: option.textContent ?? "", value: option.value }
      : null;
  });
}

async function closeAllOpenCashSessions(page: Page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto("/cash/close");

    const closeButton = page.getByRole("button", { name: "Fechar caixa" });

    if ((await closeButton.count()) === 0) {
      return;
    }

    await page.getByLabel("Valor contado no caixa").first().fill("999999,00");
    await closeButton.first().click();
    await expect(page.getByText("Caixa fechado com sucesso.")).toBeVisible();
  }
}
