import { resolveRemoteTarget } from "./remote-environment-policy.mjs";
import { buildSupabaseUrl } from "./supabase-management-client.mjs";

const releaseEnvironmentFields = Object.freeze({
  commitSha: "PRODUCTION_RELEASE_COMMIT_SHA",
  deploymentId: "PRODUCTION_RELEASE_DEPLOYMENT_ID",
  deploymentUrl: "PRODUCTION_RELEASE_DEPLOYMENT_URL",
  sourceRef: "PRODUCTION_RELEASE_SOURCE_REF",
});

export function resolveRemoteProductionPlaywrightEnvironment(
  environment,
  manifest,
) {
  return resolveRemoteProductionSmokeEnvironment(
    environment,
    manifest,
    readProductionReleaseDeploymentTarget(environment),
  );
}

export function productionReleaseDeploymentEnvironment(deploymentTarget) {
  if (!deploymentTarget) return {};
  return Object.fromEntries(
    Object.entries(releaseEnvironmentFields).map(([key, name]) => [
      name,
      deploymentTarget[key],
    ]),
  );
}

function readProductionReleaseDeploymentTarget(environment) {
  const entries = Object.entries(releaseEnvironmentFields).map(
    ([key, name]) => [key, environment[name]?.trim()],
  );
  const present = entries.filter(([, value]) => Boolean(value));
  if (present.length === 0) return null;
  if (present.length !== entries.length) {
    throw new Error("Playwright requires all release deployment fields.");
  }
  const target = Object.fromEntries(entries);
  if (
    !/^dpl_[A-Za-z0-9]+$/.test(target.deploymentId) ||
    !/^[a-f0-9]{40}$/.test(target.commitSha) ||
    target.sourceRef !== "main"
  ) {
    throw new Error("Playwright release deployment fields are invalid.");
  }
  return target;
}

export function resolveRemoteProductionSmokeEnvironment(
  environment,
  manifest,
  deploymentTarget = /** @type {any} */ (null),
) {
  const vercelTarget = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "vercel",
  });
  const supabaseTarget = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "supabase",
  });
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "PRODUCTION_ADMIN_EMAIL",
    "PRODUCTION_ADMIN_PASSWORD",
    "PRODUCTION_BASE_URL",
  ];
  if (required.some((name) => !environment[name]?.trim())) {
    throw new Error("Missing remote production variables.");
  }
  if (!supabaseTarget.projectRef) {
    throw new Error(
      "The production project ref must be registered for remote smoke.",
    );
  }
  const deploymentId =
    deploymentTarget?.deploymentId ?? vercelTarget.deploymentId;
  const deploymentUrl =
    deploymentTarget?.deploymentUrl ?? vercelTarget.deploymentUrl;
  if (!deploymentId || !deploymentUrl) {
    throw new Error(
      "The immutable production deployment must be registered for remote smoke.",
    );
  }
  if (
    Object.entries(environment).some(
      ([name, value]) => name.startsWith("STAGING_") && Boolean(value),
    )
  ) {
    throw new Error("Staging credentials cannot be used for production smoke.");
  }
  if (
    Object.entries(environment).some(
      ([name, value]) =>
        /^E2E_.+_(EMAIL|PASSWORD)$/.test(name) && Boolean(value),
    )
  ) {
    throw new Error(
      "Local E2E credentials cannot be used for production smoke.",
    );
  }
  if (
    ["E2E_LOCAL_RESET", "E2E_SEED", "E2E_ALLOW_MUTATIONS"].some(
      (name) => environment[name] === "1",
    )
  ) {
    throw new Error("A mutating remote E2E option is enabled.");
  }

  const baseUrlText = environment.PRODUCTION_BASE_URL;
  const baseUrl = parseUrl(baseUrlText);
  const expectedBaseUrl = parseUrl(deploymentUrl);
  if (
    baseUrl.protocol !== "https:" ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.port ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash ||
    ![deploymentUrl, `${deploymentUrl}/`].includes(baseUrlText) ||
    baseUrl.href !== expectedBaseUrl.href
  ) {
    throw new Error(
      "PRODUCTION_BASE_URL must use the approved HTTPS immutable Vercel deployment URL.",
    );
  }
  const supabaseUrl = parseUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (
    supabaseUrl.href.replace(/\/$/, "") !==
    buildSupabaseUrl(supabaseTarget.projectRef)
  ) {
    throw new Error(
      "Remote smoke must use the registered Supabase project ref.",
    );
  }
  return {
    baseUrl: deploymentUrl,
    email: environment.PRODUCTION_ADMIN_EMAIL,
    password: environment.PRODUCTION_ADMIN_PASSWORD,
  };
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    throw new Error("Remote production smoke URLs are invalid.");
  }
}
