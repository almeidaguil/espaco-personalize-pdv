import { describe, expect, test } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import {
  createRemoteStagingPlaywrightUse,
  resolveRemoteStagingSmokeEnvironment,
} from "./remote-staging-smoke-environment.mjs";

const projectRef = "qrstabcdefghijklmnop";
const manifest = createManifest();
const validEnvironment = {
  E2E_BASE_URL: "https://roberto-multimarcas-pdv-staging.vercel.app",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-sentinel",
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  STAGING_ADMIN_EMAIL: "owner@roberto-multimarcas.test",
  STAGING_ADMIN_PASSWORD: "Strong-staging-password-2026!",
  VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret-sentinel",
};

describe("resolveRemoteStagingSmokeEnvironment", () => {
  test("returns the exact remote staging configuration", () => {
    expect(
      resolveRemoteStagingSmokeEnvironment(validEnvironment, manifest),
    ).toEqual({
      baseUrl: "https://roberto-multimarcas-pdv-staging.vercel.app",
      bypassSecret: "bypass-secret-sentinel",
      email: "owner@roberto-multimarcas.test",
      password: "Strong-staging-password-2026!",
      publishableKey: "publishable-key-sentinel",
      supabaseUrl: `https://${projectRef}.supabase.co`,
    });
  });

  test.each([
    [{ E2E_BASE_URL: "http://localhost:3000" }, /HTTPS Vercel staging/i],
    [
      { E2E_BASE_URL: "https://legacy-project.vercel.app" },
      /HTTPS Vercel staging/i,
    ],
    [
      { NEXT_PUBLIC_SUPABASE_URL: "https://gpywbeoqcovjrfnmbdqx.supabase.co" },
      /Supabase project ref/i,
    ],
    [
      {
        E2E_USER_EMAIL: validEnvironment.STAGING_ADMIN_EMAIL,
        E2E_USER_PASSWORD: "different-password",
      },
      /local E2E credentials/i,
    ],
    [{ E2E_LOCAL_RESET: "1" }, /mutating remote E2E option/i],
    [{ E2E_SEED: "1" }, /mutating remote E2E option/i],
  ])("rejects unsafe remote smoke configuration", (override, error) => {
    expect(() =>
      resolveRemoteStagingSmokeEnvironment(
        { ...validEnvironment, ...override },
        manifest,
      ),
    ).toThrow(error);
  });

  test("rejects missing remote staging variables", () => {
    expect(() => resolveRemoteStagingSmokeEnvironment({}, manifest)).toThrow(
      /missing remote staging variables/i,
    );
  });

  test("rejects a manifest without the provisioned staging ref", () => {
    const missingTarget = structuredClone(manifest);
    missingTarget.supabase.targets.staging.projectRef = null;
    missingTarget.supabase.targets.staging.hostname = null;
    expect(() =>
      resolveRemoteStagingSmokeEnvironment(
        validEnvironment,
        parseRemoteEnvironmentManifest(missingTarget),
      ),
    ).toThrow(/staging project ref/i);
  });
});

describe("createRemoteStagingPlaywrightUse", () => {
  test("disables traces so the temporary bypass secret cannot reach an artifact", () => {
    const resolved = resolveRemoteStagingSmokeEnvironment(
      validEnvironment,
      manifest,
    );

    expect(createRemoteStagingPlaywrightUse(resolved)).toEqual({
      baseURL: resolved.baseUrl,
      extraHTTPHeaders: {
        "x-vercel-protection-bypass": "bypass-secret-sentinel",
        "x-vercel-set-bypass-cookie": "true",
      },
      trace: "off",
    });
  });
});

function createManifest() {
  const value = {
    ...manifestFixture,
    vercel: {
      ...manifestFixture.vercel,
      deploymentId: "dpl_preview123",
      deploymentUrl: "https://roberto-preview-build.vercel.app",
      siteUrl: "https://roberto-multimarcas-pdv-staging.vercel.app",
    },
    supabase: {
      ...manifestFixture.supabase,
      targets: {
        ...manifestFixture.supabase.targets,
        staging: {
          ...manifestFixture.supabase.targets.staging,
          hostname: `${projectRef}.supabase.co`,
          projectRef,
        },
      },
    },
  };
  return parseRemoteEnvironmentManifest(value);
}
