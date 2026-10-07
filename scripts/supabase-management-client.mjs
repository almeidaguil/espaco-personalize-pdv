import { redactSensitiveText } from "./remote-environment-policy.mjs";

const defaultBaseUrl = "https://api.supabase.com/v1";
const requestTimeoutMs = 30_000;
const projectRefPattern = /^[a-z]{20}$/;

export function createSupabaseManagementClient({
  accessToken,
  baseUrl = defaultBaseUrl,
  fetch = globalThis.fetch,
}) {
  if (!accessToken?.trim()) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  }

  const request = createRequest({ accessToken, baseUrl, fetch });

  return {
    createProject: ({ dbPass, name, organizationSlug, region }) =>
      request("/projects", {
        body: {
          db_pass: dbPass,
          name,
          organization_slug: organizationSlug,
          region,
        },
        method: "POST",
        sensitiveValues: [dbPass],
      }),
    getApiKeys: (projectRef) =>
      request(`/projects/${assertProjectRef(projectRef)}/api-keys`),
    getAuthConfig: (projectRef) =>
      request(`/projects/${assertProjectRef(projectRef)}/config/auth`),
    getDatabaseOpenApi: (projectRef) =>
      request(
        `/projects/${assertProjectRef(projectRef)}/database/openapi?schema=public`,
      ),
    getProject: (projectRef) =>
      request(`/projects/${assertProjectRef(projectRef)}`),
    listAvailableRegions: () => request("/projects/available-regions"),
    listProjects: () => request("/projects"),
    pauseProject: (projectRef) =>
      request(`/projects/${assertProjectRef(projectRef)}/pause`, {
        method: "POST",
      }),
    runReadOnlyQuery: (projectRef, query) =>
      request(
        `/projects/${assertProjectRef(projectRef)}/database/query/read-only`,
        { body: query, method: "POST" },
      ),
    updateAuthConfig: (projectRef, configuration) =>
      request(`/projects/${assertProjectRef(projectRef)}/config/auth`, {
        body: configuration,
        method: "PATCH",
      }),
  };
}

function createRequest({ accessToken, baseUrl, fetch }) {
  return async (path, { body, method = "GET", sensitiveValues = [] } = {}) => {
    const secrets = [accessToken, ...sensitiveValues];
    let response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        method,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error("Supabase request was aborted or timed out.");
      }

      const safeError = redactSensitiveText(error, secrets);
      throw new Error(
        `Supabase request failed: ${safeError.message ?? safeError}`,
      );
    }

    const text = await response.text();

    if (!response.ok) {
      const safeBody = redactSensitiveText(text, secrets);
      throw new Error(`Supabase API returned ${response.status}: ${safeBody}`);
    }

    if (response.status === 204 || text.length === 0) {
      return null;
    }

    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Supabase API returned a non-JSON response.");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Supabase API returned a non-JSON response.");
    }
  };
}

function isAbortError(error) {
  return Boolean(
    error && typeof error === "object" && error.name === "AbortError",
  );
}

export function parseSupabaseApiKeys(keys) {
  const publishable =
    keys.find((key) => key.type === "publishable") ??
    keys.find((key) => key.name === "anon");
  const secret =
    keys.find((key) => key.type === "secret") ??
    keys.find((key) => key.name === "service_role");

  if (!publishable?.api_key || !secret?.api_key) {
    throw new Error("Supabase API key set is incomplete.");
  }

  return {
    publishableKey: publishable.api_key,
    secretKey: secret.api_key,
  };
}

export function buildSupabaseUrl(projectRef) {
  return `https://${assertProjectRef(projectRef)}.supabase.co`;
}

function assertProjectRef(projectRef) {
  if (!projectRefPattern.test(projectRef)) {
    throw new Error("Invalid Supabase project ref.");
  }

  return projectRef;
}
