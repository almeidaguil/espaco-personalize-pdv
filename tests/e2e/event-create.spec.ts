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

test("admin creates an event and sees it in the events list", async ({
  page,
}) => {
  const uniqueSuffix = crypto.randomUUID();
  const eventName = `Evento E2E ${uniqueSuffix}`;
  const eventLocation = `Local E2E ${uniqueSuffix}`;

  await authenticatePage(page);

  await page.goto("/events/new");
  await page.getByLabel("Nome do evento").fill(eventName);
  await page.getByLabel("Local").fill(eventLocation);
  await page.getByLabel("Inicio").fill("2026-07-10T09:00");
  await page.getByLabel("Termino").fill("2026-07-10T18:00");
  await page.getByLabel("Evento ativo").uncheck();
  await page.getByRole("button", { name: "Salvar evento" }).click();

  await expect(page.getByText("Evento cadastrado com sucesso.")).toBeVisible();

  await page.goto("/events");

  const eventCard = await findEventCard(page, eventName);

  await expect(eventCard).toBeVisible();
  await expect(eventCard.getByText(eventLocation)).toBeVisible();
  await expect(eventCard.getByText("Inativo")).toBeVisible();
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

async function findEventCard(page: Page, eventName: string) {
  const eventCard = page.getByRole("listitem").filter({ hasText: eventName });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await eventCard.count()) > 0) {
      return eventCard;
    }

    const nextButton = page.getByRole("button", { name: "Proxima" });

    if ((await nextButton.count()) === 0 || !(await nextButton.isEnabled())) {
      return eventCard;
    }

    await nextButton.click();
  }

  return eventCard;
}
