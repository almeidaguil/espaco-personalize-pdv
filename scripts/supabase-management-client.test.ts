import { describe, expect, test, vi } from "vitest";

import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";

const accessToken = "supabase-access-token-sentinel";
const baseUrl = "https://management.test/v1";
const projectRef = "abcdefghijklmnopqrst";

describe("createSupabaseManagementClient", () => {
  test.each([
    ["listProjects", [], "GET", "/projects"],
    [
      "listAvailableRegions",
      ["wcqoluxxlvglqtebcucz"],
      "GET",
      "/projects/available-regions?organization_slug=wcqoluxxlvglqtebcucz",
    ],
    ["getProject", [projectRef], "GET", `/projects/${projectRef}`],
    [
      "getDatabaseOpenApi",
      [projectRef],
      "GET",
      `/projects/${projectRef}/database/openapi?schema=public`,
    ],
    ["pauseProject", [projectRef], "POST", `/projects/${projectRef}/pause`],
    [
      "getAuthConfig",
      [projectRef],
      "GET",
      `/projects/${projectRef}/config/auth`,
    ],
    ["getApiKeys", [projectRef], "GET", `/projects/${projectRef}/api-keys`],
  ])(
    "%s uses the authenticated management endpoint",
    async (methodName, args, method, path) => {
      const fetch = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = createSupabaseManagementClient({
        accessToken,
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

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetch.mock.calls[0];
      expect(url).toBe(`${baseUrl}${path}`);
      expect(init).toMatchObject({
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        method,
      });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    },
  );

  test("creates a free project without a paid size field", async () => {
    const fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        id: "new-project-ref",
        name: "roberto-multimarcas-pdv-staging",
      }),
    );
    const client = createSupabaseManagementClient({
      accessToken,
      baseUrl,
      fetch,
    });

    await client.createProject({
      dbPass: "database-password-sentinel",
      name: "roberto-multimarcas-pdv-staging",
      organizationSlug: "wcqoluxxlvglqtebcucz",
      region: "sa-east-1",
    });

    const [, init] = fetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      db_pass: "database-password-sentinel",
      name: "roberto-multimarcas-pdv-staging",
      organization_slug: "wcqoluxxlvglqtebcucz",
      region: "sa-east-1",
    });
    expect(init.body).not.toContain("desired_instance_size");
  });

  test("updates Auth with PATCH and the supplied public configuration", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ disable_signup: true }));
    const client = createSupabaseManagementClient({
      accessToken,
      baseUrl,
      fetch,
    });

    await client.updateAuthConfig(projectRef, {
      disable_signup: true,
      site_url: "https://roberto-multimarcas-pdv.netlify.app",
    });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${baseUrl}/projects/${projectRef}/config/auth`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({
      disable_signup: true,
      site_url: "https://roberto-multimarcas-pdv.netlify.app",
    });
  });

  test("rotates the database password through the dedicated endpoint", async () => {
    const password = "new-database-password-sentinel-Aa1!";
    const fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse({ message: "updated" }));
    const client = createSupabaseManagementClient({
      accessToken,
      baseUrl,
      fetch,
    });

    await client.updateDatabasePassword(projectRef, password);

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${baseUrl}/projects/${projectRef}/database/password`);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ password });
  });

  test("runs only the explicit read-only database query endpoint", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse([{ allowed: false }], 201));
    const client = createSupabaseManagementClient({
      accessToken,
      baseUrl,
      fetch,
    });

    await client.runReadOnlyQuery(projectRef, {
      parameters: ["authenticated"],
      query:
        "select has_table_privilege($1, 'public.sales', 'insert') as allowed",
    });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      `${baseUrl}/projects/${projectRef}/database/query/read-only`,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      parameters: ["authenticated"],
      query:
        "select has_table_privilege($1, 'public.sales', 'insert') as allowed",
    });
  });

  test("redacts tokens and database passwords from API errors", async () => {
    const dbPass = "database-password-sentinel";
    const fetch = vi
      .fn()
      .mockResolvedValue(
        textResponse(
          `denied ${accessToken} ${dbPass}`,
          422,
          "application/json",
        ),
      );
    const client = createSupabaseManagementClient({
      accessToken,
      baseUrl,
      fetch,
    });

    let message = "";
    try {
      await client.createProject({
        dbPass,
        name: "roberto-multimarcas-pdv-staging",
        organizationSlug: "wcqoluxxlvglqtebcucz",
        region: "sa-east-1",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("422");
    expect(message).not.toContain(accessToken);
    expect(message).not.toContain(dbPass);
    expect(message).toContain("[REDACTED]");
  });

  test("rejects a successful non-JSON response", async () => {
    const fetch = vi.fn().mockResolvedValue(textResponse("not json", 200));
    const client = createSupabaseManagementClient({
      accessToken,
      baseUrl,
      fetch,
    });

    await expect(client.listProjects()).rejects.toThrow(/non-JSON/i);
  });

  test("normalizes an aborted request without exposing the token", async () => {
    const fetch = vi
      .fn()
      .mockRejectedValue(new DOMException(accessToken, "AbortError"));
    const client = createSupabaseManagementClient({
      accessToken,
      baseUrl,
      fetch,
    });

    let message = "";
    try {
      await client.listProjects();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/aborted|timed out/i);
    expect(message).not.toContain(accessToken);
  });
});

describe("parseSupabaseApiKeys", () => {
  test("uses the modern publishable key and JWT service role for admin clients", () => {
    expect(
      parseSupabaseApiKeys([
        { api_key: "legacy-anon", name: "anon", type: "legacy" },
        {
          api_key: "legacy-service-role",
          name: "service_role",
          type: "legacy",
        },
        { api_key: "modern-secret", name: "default", type: "secret" },
        {
          api_key: "modern-publishable",
          name: "default",
          type: "publishable",
        },
      ]),
    ).toEqual({
      publishableKey: "modern-publishable",
      secretKey: "legacy-service-role",
    });
  });

  test("falls back to the legacy anon and service role keys", () => {
    expect(
      parseSupabaseApiKeys([
        { api_key: "legacy-anon", name: "anon", type: "legacy" },
        {
          api_key: "legacy-service-role",
          name: "service_role",
          type: "legacy",
        },
      ]),
    ).toEqual({
      publishableKey: "legacy-anon",
      secretKey: "legacy-service-role",
    });
  });

  test("rejects an incomplete key set without including key values", () => {
    expect(() =>
      parseSupabaseApiKeys([
        { api_key: "publishable-sentinel", type: "publishable" },
      ]),
    ).toThrow("Supabase API key set is incomplete.");
  });
});

test("buildSupabaseUrl derives the canonical HTTPS endpoint", () => {
  expect(buildSupabaseUrl(projectRef)).toBe(
    `https://${projectRef}.supabase.co`,
  );
  expect(() => buildSupabaseUrl("invalid")).toThrow(/project ref/i);
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
