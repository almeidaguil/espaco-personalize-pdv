import { describe, expect, test, vi } from "vitest";

import { createVercelManagementClient } from "./vercel-management-client.mjs";

const orgId = "team_jstETBWBHJi0hsir3a3bAkbK";
const projectId = "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79";

describe("createVercelManagementClient", () => {
  test("scopes project reads to the approved organization", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ id: projectId }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.getProject(projectId, orgId);

    expect(fetch).toHaveBeenCalledWith(
      `https://api.vercel.com/v9/projects/${projectId}?teamId=${orgId}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer vercel-token-sentinel",
        }),
        method: "GET",
      }),
    );
  });

  test("upserts variables only into the requested environment", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ created: true }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.upsertProjectEnvironmentVariable({
      key: "SUPABASE_SECRET_KEY",
      orgId,
      projectId,
      targetEnvironment: "production",
      type: "sensitive",
      value: "service-secret-sentinel",
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(
      `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${orgId}&upsert=true`,
    );
    expect(JSON.parse(options.body)).toEqual({
      key: "SUPABASE_SECRET_KEY",
      target: ["production"],
      type: "sensitive",
      value: "service-secret-sentinel",
    });
  });

  test("lists every project deployment without hiding Preview", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ deployments: [] }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.listProjectDeployments(projectId, orgId);

    expect(fetch).toHaveBeenCalledWith(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${orgId}`,
      expect.any(Object),
    );
  });

  test("lists project domains inside the approved organization", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ domains: [] }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.listProjectDomains(projectId, orgId);

    expect(fetch).toHaveBeenCalledWith(
      `https://api.vercel.com/v9/projects/${projectId}/domains?teamId=${orgId}`,
      expect.any(Object),
    );
  });

  test("creates a production-target deployment inside the dedicated staging project", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ id: "dpl_staging123", target: "production" }),
      );
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.createStagingDeployment({
      branch: "feature/provision-roberto-environments",
      orgId,
      projectId,
      projectName: "roberto-multimarcas-pdv-staging",
      repositoryId: 1264018806,
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`https://api.vercel.com/v13/deployments?teamId=${orgId}`);
    expect(JSON.parse(options.body)).toEqual({
      gitSource: {
        ref: "feature/provision-roberto-environments",
        repoId: 1264018806,
        type: "github",
      },
      meta: {
        dedicated_staging: "true",
        pr08: "true",
        roberto_environment: "staging",
      },
      name: "roberto-multimarcas-pdv-staging",
      project: projectId,
      target: "production",
    });
  });

  test("creates and revokes an automation bypass through HTTPS without returning it in errors", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          protectionBypass: {
            "temporary-bypass-sentinel": { scope: "automation-bypass" },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ protectionBypass: {} }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.createAutomationBypass({
      orgId,
      projectId,
      secret: "temporary-bypass-sentinel",
    });
    await client.revokeAutomationBypass({
      orgId,
      projectId,
      secret: "temporary-bypass-sentinel",
    });

    expect(fetch.mock.calls[0][0]).toBe(
      `https://api.vercel.com/v1/projects/${projectId}/protection-bypass?teamId=${orgId}`,
    );
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      generate: { secret: "temporary-bypass-sentinel" },
    });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
      revoke: { regenerate: false, secret: "temporary-bypass-sentinel" },
    });
  });

  test("deletes only an explicitly identified deployment", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.deleteDeployment("dpl_unintended123", orgId);

    expect(fetch).toHaveBeenCalledWith(
      `https://api.vercel.com/v13/deployments/dpl_unintended123?teamId=${orgId}`,
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("redacts tokens and variable values from failed responses", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: "vercel-token-sentinel service-secret-sentinel" },
          403,
        ),
      );
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await expect(
      client.upsertProjectEnvironmentVariable({
        key: "SUPABASE_SECRET_KEY",
        orgId,
        projectId,
        targetEnvironment: "production",
        type: "sensitive",
        value: "service-secret-sentinel",
      }),
    ).rejects.toThrow(/\[REDACTED\]/);

    await expect(
      client.upsertProjectEnvironmentVariable({
        key: "SUPABASE_SECRET_KEY",
        orgId,
        projectId,
        targetEnvironment: "production",
        type: "sensitive",
        value: "service-secret-sentinel",
      }),
    ).rejects.not.toThrow(/sentinel/);
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status,
  });
}
