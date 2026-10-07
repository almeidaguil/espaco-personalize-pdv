import { describe, expect, test, vi } from "vitest";

import { createNetlifyManagementClient } from "./netlify-management-client.mjs";

const authToken = "netlify-auth-token-sentinel";
const baseUrl = "https://netlify.test/api/v1";
const accountId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";

describe("createNetlifyManagementClient", () => {
  test.each([
    ["getAccount", [accountId], "GET", `/accounts/${accountId}`],
    ["listSites", [], "GET", "/sites"],
    ["getSite", [siteId], "GET", `/sites/${siteId}`],
  ])(
    "%s uses the authenticated management endpoint",
    async (methodName, args, method, path) => {
      const fetch = vi.fn().mockResolvedValue(jsonResponse({ id: "result" }));
      const client = createNetlifyManagementClient({
        authToken,
        baseUrl,
        fetch,
      });

      await Reflect.apply(
        client[methodName as keyof typeof client] as (
          ...values: unknown[]
        ) => unknown,
        client,
        args,
      );

      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe(`${baseUrl}${path}`);
      expect(init).toMatchObject({
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        method,
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    },
  );

  test("creates a site inside the exact approved account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ id: siteId, name: "roberto-multimarcas-pdv" }, 201),
      );
    const client = createNetlifyManagementClient({
      authToken,
      baseUrl,
      fetch,
    });

    await client.createSite(accountId, {
      name: "roberto-multimarcas-pdv",
      prevent_non_git_prod_deploys: true,
    });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${baseUrl}/${accountId}/sites`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "roberto-multimarcas-pdv",
      prevent_non_git_prod_deploys: true,
    });
  });

  test("updates a site with PATCH", async () => {
    const fetch = vi.fn().mockResolvedValue(jsonResponse({ id: siteId }));
    const client = createNetlifyManagementClient({
      authToken,
      baseUrl,
      fetch,
    });

    await client.updateSite(siteId, {
      build_settings: {
        allowed_branches: ["develop"],
        repo_branch: "netlify-production-disabled-pr09",
      },
    });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${baseUrl}/sites/${siteId}`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      build_settings: {
        allowed_branches: ["develop"],
        repo_branch: "netlify-production-disabled-pr09",
      },
    });
  });

  test("creates secret variables only for non-production contexts on Free", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([], 201));
    const client = createNetlifyManagementClient({
      authToken,
      baseUrl,
      fetch,
    });

    const result = await client.upsertSiteEnvironmentVariables({
      accountId,
      branch: "develop",
      siteId,
      variables: {
        NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
        SUPABASE_SECRET_KEY: "supabase-secret-sentinel",
      },
    });

    expect(result).toEqual({
      keys: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"],
      updated: 2,
    });
    const [readUrl] = fetch.mock.calls[0];
    expect(readUrl).toBe(
      `${baseUrl}/accounts/${accountId}/env?site_id=${siteId}`,
    );
    const [writeUrl, writeInit] = fetch.mock.calls[1];
    expect(writeUrl).toBe(
      `${baseUrl}/accounts/${accountId}/env?site_id=${siteId}`,
    );
    expect(writeInit.method).toBe("POST");
    expect(JSON.parse(writeInit.body)).toEqual([
      {
        is_secret: true,
        key: "NEXT_PUBLIC_SUPABASE_URL",
        values: [
          {
            context: "deploy-preview",
            value: "https://abcdefghijklmnopqrst.supabase.co",
          },
          {
            context: "branch-deploy",
            value: "https://abcdefghijklmnopqrst.supabase.co",
          },
          {
            context: "branch",
            context_parameter: "develop",
            value: "https://abcdefghijklmnopqrst.supabase.co",
          },
        ],
      },
      {
        is_secret: true,
        key: "SUPABASE_SECRET_KEY",
        values: [
          { context: "deploy-preview", value: "supabase-secret-sentinel" },
          { context: "branch-deploy", value: "supabase-secret-sentinel" },
          {
            context: "branch",
            context_parameter: "develop",
            value: "supabase-secret-sentinel",
          },
        ],
      },
    ]);
    expect(writeInit.body).not.toContain('"context":"production"');
    expect(writeInit.body).not.toContain('"scopes"');
  });

  test("updates existing variables idempotently and returns no values", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            is_secret: true,
            key: "SUPABASE_SECRET_KEY",
            values: [{ context: "deploy-preview", value: "********" }],
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ key: "SUPABASE_SECRET_KEY" }));
    const client = createNetlifyManagementClient({
      authToken,
      baseUrl,
      fetch,
    });

    const result = await client.upsertSiteEnvironmentVariables({
      accountId,
      branch: "develop",
      siteId,
      variables: { SUPABASE_SECRET_KEY: "new-secret-sentinel" },
    });

    expect(result).toEqual({ keys: ["SUPABASE_SECRET_KEY"], updated: 1 });
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe(
      `${baseUrl}/accounts/${accountId}/env/SUPABASE_SECRET_KEY?site_id=${siteId}`,
    );
    expect(init.method).toBe("PUT");
    expect(JSON.stringify(result)).not.toContain("new-secret-sentinel");
  });

  test("redacts token and variable values from API errors", async () => {
    const variable = "variable-secret-sentinel";
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        textResponse(`denied ${authToken} ${variable}`, 422),
      );
    const client = createNetlifyManagementClient({
      authToken,
      baseUrl,
      fetch,
    });

    let message = "";
    try {
      await client.upsertSiteEnvironmentVariables({
        accountId,
        branch: "develop",
        siteId,
        variables: { SUPABASE_SECRET_KEY: variable },
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("422");
    expect(message).not.toContain(authToken);
    expect(message).not.toContain(variable);
  });

  test("rejects non-JSON and normalizes aborted requests", async () => {
    const nonJsonClient = createNetlifyManagementClient({
      authToken,
      baseUrl,
      fetch: vi.fn().mockResolvedValue(textResponse("html", 200, "text/html")),
    });
    await expect(nonJsonClient.listSites()).rejects.toThrow(/non-JSON/i);

    const abortedClient = createNetlifyManagementClient({
      authToken,
      baseUrl,
      fetch: vi
        .fn()
        .mockRejectedValue(new DOMException(authToken, "AbortError")),
    });
    await expect(abortedClient.listSites()).rejects.toThrow(
      /aborted|timed out/i,
    );
  });
});

function jsonResponse(body: unknown, status = 200) {
  return textResponse(JSON.stringify(body), status, "application/json");
}

function textResponse(body: string, status = 200, contentType = "text/plain") {
  return {
    headers: {
      get: (name: string) => (name === "content-type" ? contentType : null),
    },
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}
