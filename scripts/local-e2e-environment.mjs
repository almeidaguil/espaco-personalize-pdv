import { randomBytes } from "node:crypto";

import { assertLocalSupabaseUrl } from "./e2e-test-users.mjs";

/** @param {string} output */
export function parseSupabaseEnvironment(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const separator = line.indexOf("=");
        const value = line.slice(separator + 1).trim();
        const first = value.at(0);
        const last = value.at(-1);
        const quoted =
          value.length >= 2 &&
          ((first === '"' && last === '"') || (first === "'" && last === "'"));
        return [line.slice(0, separator), quoted ? value.slice(1, -1) : value];
      }),
  );
}

/** @param {string} value */
function assertLocalDatabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid local E2E database URL.");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error("The E2E database URL must target the local instance.");
  }
}

/**
 * @param {Record<string, string | undefined>} environment
 * @param {string[]} args
 */
export function assertLocalE2ETargets(environment, args = []) {
  if (args.length) {
    throw new Error("The local E2E gate accepts no arguments.");
  }
  if (environment.E2E_EXPECTED_SUPABASE_PROJECT_REF) {
    throw new Error("The local E2E gate does not accept a project ref.");
  }
  for (const name of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "DATABASE_TEST_SUPABASE_URL",
    "E2E_BASE_URL",
  ]) {
    if (environment[name]) assertLocalSupabaseUrl(environment[name]);
  }
  if (environment.DB_URL) assertLocalDatabaseUrl(environment.DB_URL);
}

/**
 * @param {Record<string, string | undefined>} environment
 * @param {Record<string, string | undefined>} supabaseStatus
 * @returns {Record<string, string | undefined>}
 */
export function buildLocalE2EEnvironment(environment, supabaseStatus) {
  assertLocalE2ETargets(environment);
  const missing = ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"].filter(
    (name) => !supabaseStatus[name]?.trim(),
  );
  if (missing.length) {
    throw new Error(`Missing local Supabase values: ${missing.join(", ")}.`);
  }
  assertLocalSupabaseUrl(supabaseStatus.API_URL);
  if (supabaseStatus.DB_URL) assertLocalDatabaseUrl(supabaseStatus.DB_URL);

  const child = {
    ...environment,
    NEXT_PUBLIC_SUPABASE_URL: supabaseStatus.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseStatus.PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: supabaseStatus.SECRET_KEY,
    SUPABASE_TELEMETRY_DISABLED: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    E2E_BASE_URL: "http://localhost:3000",
    E2E_LOCAL_RESET: "1",
  };
  const runId = randomBytes(16).toString("hex");
  for (const [prefix, name] of [
    ["E2E_USER", "admin"],
    ["E2E_OPERATOR_A", "operator-a"],
    ["E2E_OPERATOR_B", "operator-b"],
  ]) {
    child[`${prefix}_EMAIL`] = `${name}-${runId}@example.test`;
    child[`${prefix}_PASSWORD`] = randomBytes(32).toString("hex");
  }
  return child;
}
