import { describe, expect, test, vi } from "vitest";

import * as remoteEnvironmentPolicy from "./remote-environment-policy.mjs";
import {
  createSafeLogger,
  parseRemoteEnvironmentManifest,
  redactSensitiveText,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

const manifestFixture = {
  vercel: {
    framework: "nextjs",
    gitConnectionAllowed: false,
    nodeVersion: "22.x",
    orgId: "team_jstETBWBHJi0hsir3a3bAkbK",
    repository: "almeidaguil/espaco-personalize-pdv",
    repositoryId: 1264018806,
    scope: "guilherme-a-s-projects",
    targets: {
      production: {
        allowedSourceRefs: ["feature/production-cutover", "main"],
        dedicatedStaging: false,
        deploymentId: null,
        deploymentProtection: "application-auth",
        deploymentUrl: null,
        environment: "production",
        projectId: "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq",
        projectName: "roberto-multimarcas-pdv",
        releaseBranch: "main",
        siteUrl: "https://roberto-multimarcas-pdv.vercel.app",
        sourceRef: "feature/production-cutover",
      },
      staging: {
        allowedSourceRefs: ["feature/provision-roberto-environments"],
        dedicatedStaging: true,
        deploymentId: "dpl_3oB2HRYi5KBaHzQAk7Y6cnZvfdqD",
        deploymentProtection: "vercel-authentication",
        deploymentUrl:
          "https://roberto-multimarcas-pdv-staging-6emhr7cxk.vercel.app",
        environment: "production",
        projectId: "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79",
        projectName: "roberto-multimarcas-pdv-staging",
        releaseBranch: "develop",
        siteUrl: "https://roberto-multimarcas-pdv-staging.vercel.app",
        sourceRef: "feature/provision-roberto-environments",
      },
    },
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
  version: 2,
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
    expect(manifest.vercel).toMatchObject({
      framework: "nextjs",
      gitConnectionAllowed: false,
      orgId: "team_jstETBWBHJi0hsir3a3bAkbK",
      repository: "almeidaguil/espaco-personalize-pdv",
      repositoryId: 1264018806,
      targets: {
        production: {
          deploymentId: null,
          deploymentProtection: "application-auth",
          projectId: "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq",
          sourceRef: "feature/production-cutover",
        },
        staging: {
          deploymentProtection: "vercel-authentication",
          projectId: "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79",
          sourceRef: "feature/provision-roberto-environments",
        },
      },
    });
  });

  test.each([
    [
      "invalid Supabase ref",
      { path: ["supabase", "legacy", "staging", "projectRef"], value: "short" },
    ],
    [
      "invalid Vercel project id",
      {
        path: ["vercel", "targets", "staging", "projectId"],
        value: "not-a-project-id",
      },
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

  test("rejects unrecognized fields instead of silently accepting secrets", () => {
    const invalidManifest = structuredClone(manifestFixture);
    Object.assign(invalidManifest.vercel.targets.production, {
      secretKey: "must-not-be-accepted",
    });

    expect(() => parseRemoteEnvironmentManifest(invalidManifest)).toThrow(
      /manifest/i,
    );
  });

  test("rejects unrecognized fields inside Supabase targets", () => {
    const invalidManifest = structuredClone(manifestFixture);
    Object.assign(invalidManifest.supabase.targets.production, {
      databasePassword: "must-not-be-accepted",
    });

    expect(() => parseRemoteEnvironmentManifest(invalidManifest)).toThrow(
      /manifest/i,
    );
  });
});

describe("resolveRemoteTarget", () => {
  test("normalizes common Vercel metadata with the selected staging target", () => {
    const target = remoteEnvironmentPolicy.resolveRemoteTarget(
      manifestFixture,
      {
        environment: "staging",
        provider: "vercel",
      },
    );

    expect(target).toMatchObject({
      environment: "staging",
      framework: "nextjs",
      identifier: "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79",
      logicalEnvironment: "staging",
      orgId: "team_jstETBWBHJi0hsir3a3bAkbK",
      projectId: "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79",
      projectName: "roberto-multimarcas-pdv-staging",
      provider: "vercel",
      siteUrl: "https://roberto-multimarcas-pdv-staging.vercel.app",
    });
    expect(Object.isFrozen(target)).toBe(true);
    expect(Object.isFrozen(target.allowedSourceRefs)).toBe(true);
  });

  test("normalizes a nullable pre-provisioning Supabase production target", () => {
    expect(
      remoteEnvironmentPolicy.resolveRemoteTarget(manifestFixture, {
        environment: "production",
        provider: "supabase",
      }),
    ).toEqual({
      environment: "production",
      hostname: null,
      identifier: "roberto-multimarcas-pdv",
      name: "roberto-multimarcas-pdv",
      organizationId: "wcqoluxxlvglqtebcucz",
      projectRef: null,
      provider: "supabase",
      region: "sa-east-1",
    });
  });

  test("rejects an unsupported provider or logical environment", () => {
    expect(() =>
      remoteEnvironmentPolicy.resolveRemoteTarget(manifestFixture, {
        environment: "preview",
        provider: "vercel",
      }),
    ).toThrow(/unsupported remote provider or environment/i);
  });
});

describe("validateRemoteOperation", () => {
  const manifest = manifestFixture;

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

  test("authorizes a Vercel mutation only for the exact project id", () => {
    expect(
      validateRemoteOperation({
        confirmation: "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79",
        environment: "staging",
        execute: true,
        manifest,
        operation: "mutate",
        provider: "vercel",
        target: {
          orgId: "team_jstETBWBHJi0hsir3a3bAkbK",
          projectId: "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79",
          projectName: "roberto-multimarcas-pdv-staging",
        },
      }),
    ).toMatchObject({
      identifier: "prj_fb7pug2hcbCGI1XIMLz5VuMr4S79",
      result: "authorized",
    });
  });

  test("authorizes production only for the exact Vercel project", () => {
    const target = manifest.vercel.targets.production;

    expect(
      validateRemoteOperation({
        confirmation: target.projectId,
        environment: "production",
        execute: true,
        manifest,
        operation: "mutate",
        provider: "vercel",
        target: {
          orgId: manifest.vercel.orgId,
          projectId: target.projectId,
          projectName: target.projectName,
        },
      }),
    ).toMatchObject({
      environment: "production",
      identifier: "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq",
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
