import { redactSensitiveText } from "./remote-environment-policy.mjs";

const defaultBaseUrl = "https://api.netlify.com/api/v1";
const requestTimeoutMs = 30_000;

export function createNetlifyManagementClient({
  authToken,
  baseUrl = defaultBaseUrl,
  fetch = globalThis.fetch,
}) {
  if (!authToken?.trim()) {
    throw new Error("NETLIFY_AUTH_TOKEN is required.");
  }

  const request = createRequest({ authToken, baseUrl, fetch });

  return {
    createSite: (accountId, site) =>
      request(`/${encodeURIComponent(accountId)}/sites`, {
        body: site,
        method: "POST",
      }),
    getAccount: (accountId) =>
      request(`/accounts/${encodeURIComponent(accountId)}`),
    getSite: (siteId) => request(`/sites/${encodeURIComponent(siteId)}`),
    listSites: () => request("/sites"),
    updateSite: (siteId, site) =>
      request(`/sites/${encodeURIComponent(siteId)}`, {
        body: site,
        method: "PATCH",
      }),
    upsertSiteEnvironmentVariables: (options) =>
      upsertSiteEnvironmentVariables(request, options),
  };
}

async function upsertSiteEnvironmentVariables(
  request,
  { accountId, branch, siteId, variables },
) {
  const query = `?site_id=${encodeURIComponent(siteId)}`;
  const basePath = `/accounts/${encodeURIComponent(accountId)}/env`;
  const existing = await request(`${basePath}${query}`);
  const existingKeys = new Set(existing.map((variable) => variable.key));
  const entries = Object.entries(variables).map(([key, value]) => ({
    is_secret: true,
    key,
    values: [
      { context: "deploy-preview", value },
      { context: "branch-deploy", value },
      { context: "branch", context_parameter: branch, value },
    ],
  }));
  const sensitiveValues = Object.values(variables);
  const newEntries = entries.filter((entry) => !existingKeys.has(entry.key));
  const existingEntries = entries.filter((entry) =>
    existingKeys.has(entry.key),
  );

  if (newEntries.length > 0) {
    await request(`${basePath}${query}`, {
      body: newEntries,
      method: "POST",
      sensitiveValues,
    });
  }

  for (const entry of existingEntries) {
    await request(`${basePath}/${encodeURIComponent(entry.key)}${query}`, {
      body: entry,
      method: "PUT",
      sensitiveValues,
    });
  }

  return {
    keys: entries.map((entry) => entry.key),
    updated: entries.length,
  };
}

function createRequest({ authToken, baseUrl, fetch }) {
  return async (path, { body, method = "GET", sensitiveValues = [] } = {}) => {
    const secrets = [authToken, ...sensitiveValues];
    let response;

    try {
      response = await fetch(`${baseUrl}${path}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${authToken}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        method,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new Error("Netlify request was aborted or timed out.");
      }

      const safeError = redactSensitiveText(error, secrets);
      throw new Error(
        `Netlify request failed: ${safeError.message ?? safeError}`,
      );
    }

    const text = await response.text();

    if (!response.ok) {
      const safeBody = redactSensitiveText(text, secrets);
      throw new Error(`Netlify API returned ${response.status}: ${safeBody}`);
    }

    if (response.status === 204 || text.length === 0) {
      return null;
    }

    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Netlify API returned a non-JSON response.");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Netlify API returned a non-JSON response.");
    }
  };
}

function isAbortError(error) {
  return Boolean(
    error && typeof error === "object" && error.name === "AbortError",
  );
}
