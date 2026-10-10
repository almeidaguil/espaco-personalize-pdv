import { expect, test } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import {
  resolveRemoteProductionPlaywrightEnvironment,
  resolveRemoteProductionSmokeEnvironment,
} from "./remote-production-smoke-environment.mjs";

const projectRef = "abcdefghijklmnopqrst";

test("returns only the exact production URL and in-memory credentials", () => {
  expect(
    resolveRemoteProductionSmokeEnvironment(validEnvironment(), manifest()),
  ).toEqual({
    baseUrl: "https://roberto-production-build.vercel.app",
    email: "owner@roberto-multimarcas.test",
    password: "Strong-production-password-2026!",
  });
});

test.each([
  [
    "wrong URL",
    { PRODUCTION_BASE_URL: "https://other.vercel.app" },
    /approved HTTPS immutable Vercel deployment/i,
  ],
  [
    "URL with a port",
    {
      PRODUCTION_BASE_URL: "https://roberto-production-build.vercel.app:8443",
    },
    /approved HTTPS immutable Vercel deployment/i,
  ],
  [
    "URL with a query",
    {
      PRODUCTION_BASE_URL:
        "https://roberto-production-build.vercel.app?preview=1",
    },
    /approved HTTPS immutable Vercel deployment/i,
  ],
  [
    "URL with a fragment",
    {
      PRODUCTION_BASE_URL:
        "https://roberto-production-build.vercel.app#preview",
    },
    /approved HTTPS immutable Vercel deployment/i,
  ],
  [
    "wrong ref",
    { NEXT_PUBLIC_SUPABASE_URL: "https://otsxpchqtfypxgzjzrxs.supabase.co" },
    /registered Supabase project ref/i,
  ],
  [
    "staging credentials",
    { STAGING_ADMIN_EMAIL: "owner@roberto-multimarcas.test" },
    /staging credentials/i,
  ],
  [
    "E2E credentials",
    { E2E_USER_PASSWORD: "Strong-production-password-2026!" },
    /local E2E credentials/i,
  ],
  [
    "missing password",
    { PRODUCTION_ADMIN_PASSWORD: "" },
    /missing remote production variables/i,
  ],
])("rejects %s without exposing credentials", (_name, override, error) => {
  const environment = { ...validEnvironment(), ...override };
  let message = "";
  try {
    resolveRemoteProductionSmokeEnvironment(environment, manifest());
  } catch (caught) {
    message = (caught as Error).message;
  }
  expect(message).toMatch(error);
  expect(message).not.toContain("Strong-production-password-2026!");
});

function validEnvironment() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    PRODUCTION_ADMIN_EMAIL: "owner@roberto-multimarcas.test",
    PRODUCTION_ADMIN_PASSWORD: "Strong-production-password-2026!",
    PRODUCTION_BASE_URL: "https://roberto-production-build.vercel.app",
  };
}

function manifest() {
  const value = structuredClone(manifestFixture);
  Object.assign(value.supabase.targets.production, {
    hostname: `${projectRef}.supabase.co`,
    projectRef,
  });
  Object.assign(value.vercel.targets.production, {
    deploymentId: "dpl_Production123",
    deploymentUrl: "https://roberto-production-build.vercel.app",
  });
  return value;
}

test("uses an explicit immutable main deployment without changing the manifest", () => {
  const releaseDeployment = {
    commitSha: "b".repeat(40),
    deploymentId: "dpl_MainProduction456",
    deploymentUrl: "https://roberto-main-build.vercel.app",
    sourceRef: "main",
  };
  expect(
    resolveRemoteProductionSmokeEnvironment(
      {
        ...validEnvironment(),
        PRODUCTION_BASE_URL: releaseDeployment.deploymentUrl,
      },
      manifest(),
      releaseDeployment,
    ),
  ).toMatchObject({ baseUrl: releaseDeployment.deploymentUrl });
});

test("reconstructs the complete explicit release at the Playwright boundary", () => {
  const releaseDeployment = {
    commitSha: "b".repeat(40),
    deploymentId: "dpl_MainProduction456",
    deploymentUrl: "https://roberto-main-build.vercel.app",
    sourceRef: "main",
  };
  const environment: Record<string, string> = {
    ...validEnvironment(),
    PRODUCTION_BASE_URL: releaseDeployment.deploymentUrl,
    PRODUCTION_RELEASE_COMMIT_SHA: releaseDeployment.commitSha,
    PRODUCTION_RELEASE_DEPLOYMENT_ID: releaseDeployment.deploymentId,
    PRODUCTION_RELEASE_DEPLOYMENT_URL: releaseDeployment.deploymentUrl,
    PRODUCTION_RELEASE_SOURCE_REF: releaseDeployment.sourceRef,
  };

  expect(
    resolveRemoteProductionPlaywrightEnvironment(environment, manifest()),
  ).toMatchObject({ baseUrl: releaseDeployment.deploymentUrl });

  delete environment.PRODUCTION_RELEASE_COMMIT_SHA;
  expect(() =>
    resolveRemoteProductionPlaywrightEnvironment(environment, manifest()),
  ).toThrow(/all release deployment fields/i);
});
