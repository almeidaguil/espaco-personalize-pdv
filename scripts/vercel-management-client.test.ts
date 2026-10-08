import { describe, expect, test, vi } from "vitest";

import { createVercelManagementClient } from "./vercel-management-client.mjs";

const orgId = "team_jstETBWBHJi0hsir3a3bAkbK";
const projectId = "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq";

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

  test("upserts only Preview variables with the requested visibility", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ created: true }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.upsertProjectEnvironmentVariable({
      key: "SUPABASE_SECRET_KEY",
      orgId,
      projectId,
      type: "sensitive",
      value: "service-secret-sentinel",
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(
      `https://api.vercel.com/v10/projects/${projectId}/env?teamId=${orgId}&upsert=true`,
    );
    expect(JSON.parse(options.body)).toEqual({
      key: "SUPABASE_SECRET_KEY",
      target: ["preview"],
      type: "sensitive",
      value: "service-secret-sentinel",
    });
  });

  test("lists only production deployments through an explicit target", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ deployments: [] }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.listProductionDeployments(projectId, orgId);

    expect(fetch).toHaveBeenCalledWith(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&target=production&teamId=${orgId}`,
      expect.any(Object),
    );
  });

  test("creates a Git-source deployment without a production target", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "dpl_preview123", target: null }));
    const client = createVercelManagementClient({
      authToken: "vercel-token-sentinel",
      fetch,
    });

    await client.createPreviewDeployment({
      branch: "feature/provision-roberto-environments",
      orgId,
      projectId,
      projectName: "roberto-multimarcas-pdv",
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
      meta: { pr08: "true", roberto_environment: "staging" },
      name: "roberto-multimarcas-pdv",
      project: projectId,
    });
    expect(options.body).not.toContain('"target"');
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
        type: "sensitive",
        value: "service-secret-sentinel",
      }),
    ).rejects.toThrow(/\[REDACTED\]/);

    await expect(
      client.upsertProjectEnvironmentVariable({
        key: "SUPABASE_SECRET_KEY",
        orgId,
        projectId,
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
