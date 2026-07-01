import { readFileSync } from "node:fs";

import { createBrowserClient } from "@supabase/ssr";
import { expect, type Page, test } from "@playwright/test";

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

test("admin creates a product and sees it in the products list", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const productName = `Produto E2E ${uniqueSuffix}`;
  const productSku = `E2E-${uniqueSuffix}`;

  await authenticatePage(page);

  await page.goto("/products/new");
  await page.getByLabel("Nome do produto").fill(productName);
  await page.getByLabel("Preço").fill("35,00");
  await page.getByLabel("SKU").fill(productSku);
  await page.getByRole("button", { name: "Salvar produto" }).click();

  await expect(page.getByText("Produto cadastrado com sucesso.")).toBeVisible();

  await page.goto("/products");
  await page.getByLabel("Buscar produto").fill(productName);

  const productCard = page
    .getByRole("listitem")
    .filter({ hasText: productName });

  await expect(productCard).toBeVisible();
  await expect(productCard.getByText(productSku)).toBeVisible();
  await expect(productCard.getByText("R$ 35,00")).toBeVisible();
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
