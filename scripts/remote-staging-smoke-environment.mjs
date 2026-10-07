import { buildSupabaseUrl } from "./supabase-management-client.mjs";

export function resolveRemoteStagingSmokeEnvironment(environment, manifest) {
  const projectRef = manifest.supabase.targets.staging.projectRef;
  if (!projectRef) {
    throw new Error(
      "The staging project ref must be registered for remote smoke.",
    );
  }

  const required = [
    "E2E_BASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "STAGING_ADMIN_EMAIL",
    "STAGING_ADMIN_PASSWORD",
  ];
  const missing = required.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing remote staging variables: ${missing.join(", ")}.`);
  }

  const baseUrl = parseUrl(environment.E2E_BASE_URL);
  const expectedBaseUrl = new URL(manifest.netlify.siteUrl);
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.hostname !== expectedBaseUrl.hostname ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error(
      "E2E_BASE_URL must use the approved HTTPS Netlify hostname.",
    );
  }

  const supabaseUrl = parseUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (supabaseUrl.href.replace(/\/$/, "") !== buildSupabaseUrl(projectRef)) {
    throw new Error(
      "Remote smoke must use the registered Supabase project ref.",
    );
  }

  if (
    ["E2E_LOCAL_RESET", "E2E_SEED", "E2E_ALLOW_MUTATIONS"].some(
      (name) => environment[name] === "1",
    )
  ) {
    throw new Error("A mutating remote E2E option is enabled.");
  }

  const e2eValues = Object.entries(environment)
    .filter(([name]) => /^E2E_.+_(EMAIL|PASSWORD)$/.test(name))
    .map(([, value]) => value)
    .filter(Boolean);
  if (
    /e2e/i.test(environment.STAGING_ADMIN_EMAIL) ||
    e2eValues.some(
      (value) =>
        value === environment.STAGING_ADMIN_PASSWORD ||
        value.toLowerCase() === environment.STAGING_ADMIN_EMAIL.toLowerCase(),
    )
  ) {
    throw new Error("Local E2E credentials cannot be used for remote smoke.");
  }

  return {
    baseUrl: baseUrl.href.replace(/\/$/, ""),
    email: environment.STAGING_ADMIN_EMAIL,
    password: environment.STAGING_ADMIN_PASSWORD,
    publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    supabaseUrl: supabaseUrl.href.replace(/\/$/, ""),
  };
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    throw new Error("Remote smoke URLs are invalid.");
  }
}
