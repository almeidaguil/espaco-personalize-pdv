import { readFileSync } from "node:fs";

import { expect, type Page, test } from "@playwright/test";
import { createBrowserClient } from "@supabase/ssr";

const e2eUserEmail = process.env.E2E_USER_EMAIL;
const e2eUserPassword = process.env.E2E_USER_PASSWORD;
const e2eBaseUrl = process.env.E2E_BASE_URL?.trim() || "http://localhost:3000";
const publicEnv = getPublicEnv();

test.skip(
  !e2eUserEmail ||
    !e2eUserPassword ||
    !publicEnv.NEXT_PUBLIC_SUPABASE_URL ||
    !publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  "E2E auth and Supabase public env vars are required for authenticated E2E tests.",
);

test("admin logs in through the UI and traverses main flows", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `E2E UI Produto ${uniqueSuffix}`;
  const productSku = `E2E-UI-${uniqueSuffix}`;

  await page.goto("/login");
  await page.getByRole("textbox", { name: "E-mail" }).fill(e2eUserEmail ?? "");
  await page.getByLabel("Senha").fill(e2eUserPassword ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "PDV" }),
  ).toBeVisible();

  await authenticatePage(page);
  await closeAllOpenCashSessions(page);

  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.locator("#priceInReais").fill("42,00");
  await page.getByLabel("SKU").fill(productSku);
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();

  await page.goto("/products");
  await expect(page.getByText(productName)).toBeVisible();

  await page.goto("/cash/open");
  const activeEvent = await getFirstSelectableOption(page, "eventId");

  expect(activeEvent).not.toBeNull();

  await page.getByLabel("Evento").selectOption(activeEvent?.value ?? "");
  await page.getByLabel("Valor inicial").fill("100,00");
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(page.getByText("Caixa aberto com sucesso.")).toBeVisible();

  await page.goto("/pdv");
  await expect(page.getByText("PDV")).toBeVisible();
  await expect(
    page.getByText(getEventNameFromOption(activeEvent?.label ?? "")).first(),
  ).toBeVisible();

  await page.goto("/cash/close");
  await page.getByLabel("Valor contado no caixa").fill("100,00");
  await page.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(page.getByText("Caixa fechado com sucesso.")).toBeVisible();
});

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
