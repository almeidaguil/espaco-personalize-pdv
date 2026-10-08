import { redactSensitiveText } from "./remote-environment-policy.mjs";

const defaultBaseUrl = "https://api.vercel.com";
const requestTimeoutMs = 30_000;

export function createVercelManagementClient({
  authToken,
  baseUrl = defaultBaseUrl,
  fetch = globalThis.fetch,
}) {
  if (!authToken?.trim()) {
    throw new Error("VERCEL_TOKEN is required.");
  }

  const request = createRequest({ authToken, baseUrl, fetch });

  return {
    createPreviewDeployment: ({
      branch,
      orgId,
      projectId,
      projectName,
      repositoryId,
    }) =>
      request(`/v13/deployments?teamId=${encodeURIComponent(orgId)}`, {
        body: {
          gitSource: { ref: branch, repoId: repositoryId, type: "github" },
          meta: { pr08: "true", roberto_environment: "staging" },
          name: projectName,
          project: projectId,
        },
        method: "POST",
      }),
    deleteDeployment: (deploymentId, orgId) =>
      request(
        `/v13/deployments/${encodeURIComponent(deploymentId)}?teamId=${encodeURIComponent(orgId)}`,
        { method: "DELETE" },
      ),
    getDeployment: (deploymentId, orgId) =>
      request(
        `/v13/deployments/${encodeURIComponent(deploymentId)}?teamId=${encodeURIComponent(orgId)}`,
      ),
    getProject: (projectId, orgId) =>
      request(
        `/v9/projects/${encodeURIComponent(projectId)}?teamId=${encodeURIComponent(orgId)}`,
      ),
    listProductionDeployments: (projectId, orgId) =>
      request(
        `/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&teamId=${encodeURIComponent(orgId)}`,
      ),
    listProjectEnvironmentVariables: (projectId, orgId) =>
      request(
        `/v10/projects/${encodeURIComponent(projectId)}/env?teamId=${encodeURIComponent(orgId)}`,
      ),
    upsertProjectEnvironmentVariable: ({
      key,
      orgId,
      projectId,
      type,
      value,
    }) =>
      request(
        `/v10/projects/${encodeURIComponent(projectId)}/env?teamId=${encodeURIComponent(orgId)}&upsert=true`,
        {
          body: { key, target: ["preview"], type, value },
          method: "POST",
          sensitiveValues: [value],
        },
      ),
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
      const safeError = redactSensitiveText(error, secrets);
      throw new Error(
        `Vercel request failed: ${safeError.message ?? safeError}`,
      );
    }

    const text = await response.text();
    if (!response.ok) {
      const safeBody = redactSensitiveText(text, secrets);
      throw new Error(`Vercel API returned ${response.status}: ${safeBody}`);
    }
    if (response.status === 204 || text.length === 0) return null;
    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Vercel API returned a non-JSON response.");
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Vercel API returned a non-JSON response.");
    }
  };
}
