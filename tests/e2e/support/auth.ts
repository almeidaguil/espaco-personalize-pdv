import { readFileSync } from "node:fs";

import { type Browser, type Page } from "@playwright/test";
import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const e2eBaseUrl = process.env.E2E_BASE_URL?.trim() || "http://localhost:3000";

// Keep this browser-support contract aligned with scripts/e2e-test-users.mjs.
export type E2EUserName = "admin" | "operatorA" | "operatorB";

const userPrefixes: Record<E2EUserName, string> = {
  admin: "E2E_USER",
  operatorA: "E2E_OPERATOR_A",
  operatorB: "E2E_OPERATOR_B",
};

export function getE2EUserCredentials(userName: E2EUserName = "admin") {
  const users = Object.entries(userPrefixes).map(([name, prefix]) => {
    const email = process.env[`${prefix}_EMAIL`]?.trim();
    const password = process.env[`${prefix}_PASSWORD`];
    if (!email || !password?.trim()) {
      throw new Error(
        `Missing E2E credentials for ${name}: ${prefix}_EMAIL and ${prefix}_PASSWORD are required.`,
      );
    }
    return { name, email, password };
  });
  if (
    new Set(users.map(({ email }) => email.toLowerCase())).size !== users.length
  ) {
    throw new Error(
      "E2E admin, operatorA and operatorB must identify distinct users.",
    );
  }
  const credentials = users.find(({ name }) => name === userName);
  if (!credentials) throw new Error("Unknown E2E user identity.");
  return credentials;
}

export function hasAuthenticatedE2EConfig() {
  const publicEnv = getPublicEnv();

  return Boolean(
    process.env.E2E_USER_EMAIL &&
    process.env.E2E_USER_PASSWORD &&
    publicEnv.NEXT_PUBLIC_SUPABASE_URL &&
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function authenticatePage(
  page: Page,
  userName: E2EUserName = "admin",
) {
  const publicEnv = requirePublicEnv();
  const credentials = getE2EUserCredentials(userName);
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
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw new Error(`Failed to authenticate E2E ${userName}.`);

  await page.context().addCookies(
    [...cookieJar.entries()].map(([name, value]) => ({
      name,
      url: e2eBaseUrl,
      value,
    })),
  );
}

export async function createAuthenticatedPage(
  browser: Browser,
  userName: E2EUserName,
) {
  const context = await browser.newContext({ baseURL: e2eBaseUrl });
  try {
    const page = await context.newPage();
    await authenticatePage(page, userName);
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function createAuthenticatedSupabaseClient(
  userName: E2EUserName = "admin",
) {
  const publicEnv = requirePublicEnv();
  const credentials = getE2EUserCredentials(userName);
  const supabase = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL ?? "",
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) throw new Error(`Failed to authenticate E2E ${userName}.`);

  return supabase;
}

function requirePublicEnv() {
  const env = getPublicEnv();
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error(
      "Supabase public environment variables are required for authenticated E2E tests.",
    );
  }
  return env;
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
