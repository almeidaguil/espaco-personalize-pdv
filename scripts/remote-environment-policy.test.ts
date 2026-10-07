import { describe, expect, test, vi } from "vitest";

import {
  createSafeLogger,
  parseRemoteEnvironmentManifest,
  redactSensitiveText,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

const manifestFixture = {
  netlify: {
    accountId: null,
    productionBranch: "netlify-production-disabled-pr09",
    repository: "almeidaguil/espaco-personalize-pdv",
    siteId: null,
    siteName: "roberto-multimarcas-pdv",
    siteUrl: "https://roberto-multimarcas-pdv.netlify.app",
    stagingBranch: "develop",
  },
  supabase: {
    legacy: {
      production: {
        hostname: "ciixpfquwmlsvzleattv.supabase.co",
        name: "espaco-personalize-pdv",
        projectRef: "ciixpfquwmlsvzleattv",
        region: "us-west-2",
      },
      staging: {
        hostname: "gpywbeoqcovjrfnmbdqx.supabase.co",
        name: "espaco-personalize-pdv-staging",
        projectRef: "gpywbeoqcovjrfnmbdqx",
        region: "us-west-2",
      },
    },
    organization: {
      id: "wcqoluxxlvglqtebcucz",
      name: "almeidaguil's Org",
    },
    targets: {
      production: {
        hostname: null,
        name: "roberto-multimarcas-pdv",
        projectRef: null,
        region: "sa-east-1",
      },
      staging: {
        hostname: null,
        name: "roberto-multimarcas-pdv-staging",
        projectRef: null,
        region: "sa-east-1",
      },
    },
  },
  version: 1,
};

describe("parseRemoteEnvironmentManifest", () => {
  test("accepts the approved non-sensitive environment manifest", () => {
    const manifest = parseRemoteEnvironmentManifest(manifestFixture);

    expect(manifest.supabase.organization.id).toBe("wcqoluxxlvglqtebcucz");
    expect(manifest.supabase.legacy.staging.projectRef).toBe(
      "gpywbeoqcovjrfnmbdqx",
    );
    expect(manifest.supabase.legacy.production.projectRef).toBe(
      "ciixpfquwmlsvzleattv",
    );
    expect(manifest.supabase.targets.staging).toMatchObject({
      name: "roberto-multimarcas-pdv-staging",
      projectRef: null,
      region: "sa-east-1",
    });
    expect(manifest.supabase.targets.production.projectRef).toBeNull();
    expect(manifest.netlify).toMatchObject({
      accountId: null,
      productionBranch: "netlify-production-disabled-pr09",
      repository: "almeidaguil/espaco-personalize-pdv",
      siteId: null,
      siteName: "roberto-multimarcas-pdv",
      stagingBranch: "develop",
    });
  });

  test("accepts the current Netlify hexadecimal account id", () => {
    const configuredManifest = structuredClone(manifestFixture);
    configuredManifest.netlify.accountId = "6ac5be70c558d25c9b304db5";

    const manifest = parseRemoteEnvironmentManifest(configuredManifest);

    expect(manifest.netlify.accountId).toBe("6ac5be70c558d25c9b304db5");
  });

  test.each([
    [
      "invalid Supabase ref",
      { path: ["supabase", "legacy", "staging", "projectRef"], value: "short" },
    ],
    [
      "invalid Netlify site id",
      { path: ["netlify", "siteId"], value: "not-a-uuid" },
    ],
  ])("rejects %s", (_name, mutation) => {
    const invalidManifest = structuredClone(manifestFixture) as Record<
      string,
      unknown
    >;
    let cursor = invalidManifest;

    mutation.path.slice(0, -1).forEach((segment) => {
      cursor = cursor[segment] as Record<string, unknown>;
    });
    cursor[mutation.path.at(-1)!] = mutation.value;

    expect(() => parseRemoteEnvironmentManifest(invalidManifest)).toThrow(
      /manifest/i,
    );
  });
});

describe("validateRemoteOperation", () => {
  const manifest = parseRemoteEnvironmentManifest(manifestFixture);

  test("authorizes a read against the exact legacy staging target", () => {
    expect(
      validateRemoteOperation({
        environment: "legacy-staging",
        execute: false,
        manifest,
        operation: "read",
        provider: "supabase",
        target: {
          hostname: "gpywbeoqcovjrfnmbdqx.supabase.co",
          name: "espaco-personalize-pdv-staging",
          organizationId: "wcqoluxxlvglqtebcucz",
          projectRef: "gpywbeoqcovjrfnmbdqx",
        },
      }),
    ).toEqual({
      environment: "legacy-staging",
      hostname: "gpywbeoqcovjrfnmbdqx.supabase.co",
      identifier: "gpywbeoqcovjrfnmbdqx",
      name: "espaco-personalize-pdv-staging",
      operation: "read",
      provider: "supabase",
      result: "authorized",
    });
  });

  test("requires execute and the literal identifier for a mutation", () => {
    const input = {
      confirmation: "gpywbeoqcovjrfnmbdqx",
      environment: "legacy-staging" as const,
      execute: false,
      manifest,
      operation: "mutate" as const,
      provider: "supabase" as const,
      target: {
        hostname: "gpywbeoqcovjrfnmbdqx.supabase.co",
        name: "espaco-personalize-pdv-staging",
        organizationId: "wcqoluxxlvglqtebcucz",
        projectRef: "gpywbeoqcovjrfnmbdqx",
      },
    };

    expect(() => validateRemoteOperation(input)).toThrow(/--execute/);
    expect(() =>
      validateRemoteOperation({
        ...input,
        confirmation: "gpywbeoqcovjrfnmbdqX",
        execute: true,
      }),
    ).toThrow(/confirmação literal/i);

    expect(validateRemoteOperation({ ...input, execute: true })).toMatchObject({
      identifier: "gpywbeoqcovjrfnmbdqx",
      result: "authorized",
    });
  });

  test.each([
    ["organization", { organizationId: "wrong-org" }],
    ["hostname", { hostname: "ciixpfquwmlsvzleattv.supabase.co" }],
    ["project ref", { projectRef: "ciixpfquwmlsvzleattv" }],
  ])("rejects a divergent Supabase %s", (_name, override) => {
    expect(() =>
      validateRemoteOperation({
        environment: "legacy-staging",
        execute: false,
        manifest,
        operation: "read",
        provider: "supabase",
        target: {
          hostname: "gpywbeoqcovjrfnmbdqx.supabase.co",
          name: "espaco-personalize-pdv-staging",
          organizationId: "wcqoluxxlvglqtebcucz",
          projectRef: "gpywbeoqcovjrfnmbdqx",
          ...override,
        },
      }),
    ).toThrow(/alvo remoto divergente/i);
  });

  test("rejects a production ref presented as staging", () => {
    expect(() =>
      validateRemoteOperation({
        environment: "staging",
        execute: true,
        confirmation: "ciixpfquwmlsvzleattv",
        manifest,
        operation: "mutate",
        provider: "supabase",
        target: {
          hostname: "ciixpfquwmlsvzleattv.supabase.co",
          name: "roberto-multimarcas-pdv-staging",
          organizationId: "wcqoluxxlvglqtebcucz",
          projectRef: "ciixpfquwmlsvzleattv",
        },
      }),
    ).toThrow(/produção.*staging/i);
  });

  test("rejects a legacy ref presented as the new staging target", () => {
    expect(() =>
      validateRemoteOperation({
        environment: "staging",
        execute: true,
        confirmation: "gpywbeoqcovjrfnmbdqx",
        manifest,
        operation: "mutate",
        provider: "supabase",
        target: {
          hostname: "gpywbeoqcovjrfnmbdqx.supabase.co",
          name: "roberto-multimarcas-pdv-staging",
          organizationId: "wcqoluxxlvglqtebcucz",
          projectRef: "gpywbeoqcovjrfnmbdqx",
        },
      }),
    ).toThrow(/legado.*novo staging/i);
  });

  test("authorizes creation of the pending Netlify site by exact name", () => {
    expect(
      validateRemoteOperation({
        confirmation: "roberto-multimarcas-pdv",
        environment: "staging",
        execute: true,
        manifest,
        operation: "mutate",
        provider: "netlify",
        target: {
          accountId: null,
          hostname: "roberto-multimarcas-pdv.netlify.app",
          siteId: null,
          siteName: "roberto-multimarcas-pdv",
        },
      }),
    ).toMatchObject({
      identifier: "roberto-multimarcas-pdv",
      result: "authorized",
    });
  });
});

describe("secret redaction", () => {
  test("redacts sentinels recursively without mutating the input", () => {
    const input = {
      error: new Error("request failed with token-secret"),
      nested: ["publishable-secret", { value: "prefix token-secret suffix" }],
    };

    const redacted = redactSensitiveText(input, [
      "token-secret",
      "publishable-secret",
    ]);

    expect(JSON.stringify(redacted)).not.toContain("token-secret");
    expect(JSON.stringify(redacted)).not.toContain("publishable-secret");
    expect(redacted).toMatchObject({
      error: { message: "request failed with [REDACTED]" },
      nested: ["[REDACTED]", { value: "prefix [REDACTED] suffix" }],
    });
    expect(input.nested[0]).toBe("publishable-secret");
  });

  test("safe logger never forwards a configured secret", () => {
    const log = vi.fn();
    const safeLog = createSafeLogger({
      log,
      sensitiveValues: ["service-role-secret"],
    });

    safeLog("failed", { credential: "service-role-secret" });

    expect(log).toHaveBeenCalledWith("failed", {
      credential: "[REDACTED]",
    });
  });
});
