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
  const eventName = `Venda E2E Evento ${uniqueSuffix}`;

  await authenticatePage(page);
  await createProduct(page, productName, productSku);
  await addInitialStock(page, productName, 3);
  await createEvent(page, eventName, uniqueSuffix);
  await openCashSession(page, eventName);
  await createSale(page, productName, eventName);
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

  await page.getByLabel("Produto").selectOption(productOptionValue ?? "");
  await page.getByLabel("Quantidade").fill(String(quantity));
  await page.getByRole("button", { name: "Registrar ajuste" }).click();

  await expect(page.getByText("Estoque ajustado com sucesso.")).toBeVisible();
}

async function createEvent(
  page: Page,
  eventName: string,
  uniqueSuffix: string,
) {
  await page.goto("/events/new");
  await page.getByLabel("Nome do evento").fill(eventName);
  await page.getByLabel("Local").fill(`Local Venda E2E ${uniqueSuffix}`);
  await page.getByLabel("Inicio").fill("2026-07-13T09:00");
  await page.getByLabel("Termino").fill("2026-07-13T18:00");
  await page.getByRole("button", { name: "Salvar evento" }).click();

  await expect(page.getByText("Evento cadastrado com sucesso.")).toBeVisible();
}

async function openCashSession(page: Page, eventName: string) {
  await page.goto("/cash/open");

  const eventOptionValue = await page
    .locator("select#eventId option", { hasText: eventName })
    .getAttribute("value");

  expect(eventOptionValue).not.toBeNull();

  await page.getByLabel("Evento").selectOption(eventOptionValue ?? "");
  await page.getByLabel("Valor inicial").fill("100,00");
  await page.getByRole("button", { name: "Abrir caixa" }).click();

  await expect(page.getByText("Caixa aberto com sucesso.")).toBeVisible();
}

async function createSale(page: Page, productName: string, eventName: string) {
  await page.goto("/pdv");
  await expect(page.getByText(eventName).first()).toBeVisible();

  await page
    .locator("article", { hasText: productName })
    .getByRole("button", { name: "Adicionar" })
    .click();
  await page.getByLabel("Valor recebido").fill("20,00");
  await expect(page.getByText("Troco R$ 5,00")).toBeVisible();
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
