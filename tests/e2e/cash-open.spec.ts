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

test("admin opens one cash session without an event and the PDV uses it", async ({
  page,
}) => {
  await authenticatePage(page);
  await closeAllOpenCashSessions(page);

  await page.goto("/pdv");
  await expect(
    page.getByRole("heading", { name: "Abra o caixa antes de vender" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finalizar venda" }),
  ).toHaveCount(0);

  await page.goto("/cash/open");
  await expect(page.getByLabel("Evento")).toHaveCount(0);
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

  await closeAllOpenCashSessions(page);
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
