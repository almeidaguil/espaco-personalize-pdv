import { expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { resolveRemoteProductionPlaywrightEnvironment } from "./remote-production-smoke-environment.mjs";
import {
  runManagedRemoteProductionSmoke,
  runRemoteProductionSmokeCli,
} from "./run-remote-production-smoke.mjs";

const projectRef = "abcdefghijklmnopqrst";
const commitSha = "a".repeat(40);

test("runs only the dedicated production smoke without creating a bypass", async () => {
  const { client, input, runPlaywright } = fixture();
  await expect(runManagedRemoteProductionSmoke(input)).resolves.toMatchObject({
    deploymentId: "dpl_Production123",
    smokeStatus: "passed",
  });
  expect(runPlaywright).toHaveBeenCalledWith(
    expect.objectContaining({
      config: "playwright.remote-production.config.ts",
    }),
  );
  expect(client.createAutomationBypass).not.toHaveBeenCalled();
});

test("accepts Vercel's explicit none deployment protection", async () => {
  const { input } = fixture({ ssoProtection: { deploymentType: "none" } });

  await expect(runManagedRemoteProductionSmoke(input)).resolves.toMatchObject({
    smokeStatus: "passed",
  });
});

test("rejects any production protection or failed smoke and does not record verified", async () => {
  const protectedFixture = fixture({
    protectionBypass: { key: { scope: "automation-bypass" } },
  });
  await expect(
    runManagedRemoteProductionSmoke(protectedFixture.input),
  ).rejects.toThrow(/protection|bypass/i);

  const failed = fixture();
  failed.runPlaywright.mockResolvedValue({
    status: 1,
    stderr: "password sentinel",
    stdout: "",
  });
  await expect(runManagedRemoteProductionSmoke(failed.input)).rejects.toThrow(
    /production smoke failed/i,
  );
  expect(failed.recordPhase).not.toHaveBeenCalled();
});

test("records verified only after matching verification and smoke reports", async () => {
  const { input, recordPhase } = fixture();
  await runManagedRemoteProductionSmoke(input);
  expect(recordPhase).toHaveBeenCalledWith({
    facts: {
      checks: ["deployment-ready", "schema"],
      commitSha,
      deploymentId: "dpl_Production123",
      smokeStatus: "passed",
    },
    phase: "verified",
    previousState: expect.objectContaining({ phase: "deployment-ready" }),
  });

  const mismatch = fixture();
  mismatch.input.verificationReport.commitSha = "b".repeat(40);
  await expect(runManagedRemoteProductionSmoke(mismatch.input)).rejects.toThrow(
    /same deployment.*commit/i,
  );
  expect(mismatch.recordPhase).not.toHaveBeenCalled();
});

test("CLI runs a fresh production verification before the managed smoke", async () => {
  const { client, input, recordPhase, runPlaywright } = fixture();
  const events: string[] = [];
  const verificationReport = input.verificationReport;
  const verifyProduction = vi.fn(async () => {
    events.push("verify");
    return verificationReport;
  });
  runPlaywright.mockImplementation(async () => {
    events.push("smoke");
    return { status: 0, stderr: "", stdout: "passed" };
  });

  await expect(
    runRemoteProductionSmokeCli(
      [],
      { ...process.env, ...input.environment },
      {
        client,
        loadManifest: vi.fn().mockResolvedValue(input.manifest),
        loadState: vi.fn().mockResolvedValue(input.state),
        logger: vi.fn(),
        recordPhase,
        runPlaywright,
        verifyProduction,
      },
    ),
  ).resolves.toMatchObject({ smokeStatus: "passed" });
  expect(events).toEqual(["verify", "smoke"]);
  expect(verifyProduction).toHaveBeenCalledWith({
    deploymentTarget: null,
    environment: { ...process.env, ...input.environment },
    projectRef,
  });
});

test("CLI forwards the explicit main deployment through verification and smoke", async () => {
  const mainSha = "b".repeat(40);
  const deploymentTarget = {
    commitSha: mainSha,
    deploymentId: "dpl_MainProduction456",
    deploymentUrl: "https://roberto-main-build.vercel.app",
    sourceRef: "main",
  };
  const { client, input, recordPhase, runPlaywright } = fixture();
  const state = {
    history: [
      ...input.state.history,
      {
        facts: {
          checks: ["deployment-ready", "schema"],
          commitSha,
          deploymentId: "dpl_Production123",
          smokeStatus: "passed",
        },
        phase: "verified",
      },
    ],
    phase: "verified",
  };
  const verificationReport = {
    ...input.verificationReport,
    ...deploymentTarget,
  };
  const verifyProduction = vi.fn().mockResolvedValue(verificationReport);
  const environment = {
    ...process.env,
    ...input.environment,
    PRODUCTION_BASE_URL: deploymentTarget.deploymentUrl,
  };

  await expect(
    runRemoteProductionSmokeCli(
      [
        "--deployment-id",
        deploymentTarget.deploymentId,
        "--deployment-url",
        deploymentTarget.deploymentUrl,
        "--source-ref",
        deploymentTarget.sourceRef,
        "--commit-sha",
        deploymentTarget.commitSha,
      ],
      environment,
      {
        client,
        loadManifest: vi.fn().mockResolvedValue(input.manifest),
        loadState: vi.fn().mockResolvedValue(state),
        logger: vi.fn(),
        recordPhase,
        runPlaywright,
        verifyProduction,
      },
    ),
  ).resolves.toMatchObject({
    commitSha: mainSha,
    deploymentId: deploymentTarget.deploymentId,
    deploymentUrl: deploymentTarget.deploymentUrl,
    smokeStatus: "passed",
  });
  expect(verifyProduction).toHaveBeenCalledWith({
    deploymentTarget,
    environment,
    projectRef,
  });
  expect(recordPhase).not.toHaveBeenCalled();
});

test("smokes the explicit verified main deployment without rewriting cutover state", async () => {
  const mainSha = "b".repeat(40);
  const deploymentTarget = {
    commitSha: mainSha,
    deploymentId: "dpl_MainProduction456",
    deploymentUrl: "https://roberto-main-build.vercel.app",
    sourceRef: "main",
  };
  const { input, recordPhase, runPlaywright } = fixture();
  const state = input.state as {
    history: { facts: Record<string, unknown>; phase: string }[];
    phase: string;
  };
  state.phase = "verified";
  state.history.push({
    facts: {
      checks: ["deployment-ready", "schema"],
      commitSha,
      deploymentId: "dpl_Production123",
      smokeStatus: "passed",
    },
    phase: "verified",
  });
  input.environment.PRODUCTION_BASE_URL = deploymentTarget.deploymentUrl;
  input.verificationReport = {
    ...input.verificationReport,
    commitSha: mainSha,
    deploymentId: deploymentTarget.deploymentId,
    deploymentUrl: deploymentTarget.deploymentUrl,
    sourceRef: "main",
  };

  await expect(
    runManagedRemoteProductionSmoke({
      ...input,
      deploymentTarget,
    }),
  ).resolves.toMatchObject({
    commitSha: mainSha,
    deploymentId: deploymentTarget.deploymentId,
    deploymentUrl: deploymentTarget.deploymentUrl,
    smokeStatus: "passed",
  });
  expect(recordPhase).not.toHaveBeenCalled();
  expect(runPlaywright).toHaveBeenCalledWith(
    expect.objectContaining({
      environment: expect.objectContaining({
        baseUrl: deploymentTarget.deploymentUrl,
        PRODUCTION_RELEASE_COMMIT_SHA: deploymentTarget.commitSha,
        PRODUCTION_RELEASE_DEPLOYMENT_ID: deploymentTarget.deploymentId,
        PRODUCTION_RELEASE_DEPLOYMENT_URL: deploymentTarget.deploymentUrl,
        PRODUCTION_RELEASE_SOURCE_REF: deploymentTarget.sourceRef,
      }),
    }),
  );
  const playwrightEnvironment =
    runPlaywright.mock.calls.at(-1)?.[0].environment;
  expect(
    resolveRemoteProductionPlaywrightEnvironment(
      playwrightEnvironment,
      input.manifest,
    ),
  ).toMatchObject({ baseUrl: deploymentTarget.deploymentUrl });
});

test("rejects an explicit main deployment unless provisional verification is complete", async () => {
  const { input, recordPhase } = fixture();
  const deploymentTarget = {
    commitSha: "b".repeat(40),
    deploymentId: "dpl_MainProduction456",
    deploymentUrl: "https://roberto-main-build.vercel.app",
    sourceRef: "main",
  };
  input.environment.PRODUCTION_BASE_URL = deploymentTarget.deploymentUrl;
  input.verificationReport = {
    ...input.verificationReport,
    ...deploymentTarget,
  };

  await expect(
    runManagedRemoteProductionSmoke({ ...input, deploymentTarget }),
  ).rejects.toThrow(/verified.*main|main.*verified/i);
  expect(recordPhase).not.toHaveBeenCalled();
});

function fixture(projectOverride: Record<string, unknown> = {}) {
  const manifest = structuredClone(manifestFixture);
  Object.assign(manifest.supabase.targets.production, {
    hostname: `${projectRef}.supabase.co`,
    projectRef,
  });
  Object.assign(manifest.vercel.targets.production, {
    deploymentId: "dpl_Production123",
    deploymentUrl: "https://roberto-production-build.vercel.app",
  });
  const client = {
    createAutomationBypass: vi.fn(),
    getProject: vi.fn().mockResolvedValue({
      protectionBypass: {},
      ssoProtection: null,
      ...projectOverride,
    }),
  };
  const runPlaywright = vi
    .fn()
    .mockResolvedValue({ status: 0, stderr: "", stdout: "passed" });
  const recordPhase = vi.fn(async ({ phase }) => ({ phase }));
  const state = {
    history: [
      {
        phase: "deployment-ready",
        facts: {
          commitSha,
          deploymentId: "dpl_Production123",
          deploymentUrl: "https://roberto-production-build.vercel.app",
          projectId: "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq",
        },
      },
    ],
    phase: "deployment-ready",
  };
  return {
    client,
    recordPhase,
    runPlaywright,
    input: {
      client,
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
        PRODUCTION_ADMIN_EMAIL: "owner@roberto-multimarcas.test",
        PRODUCTION_ADMIN_PASSWORD: "Strong-production-password-2026!",
        PRODUCTION_BASE_URL: "https://roberto-production-build.vercel.app",
      },
      manifest,
      recordPhase,
      runPlaywright,
      state,
      verificationReport: {
        checks: ["schema", "deployment-ready"],
        commitSha,
        deploymentId: "dpl_Production123",
        deploymentUrl: "https://roberto-production-build.vercel.app",
        sourceRef: "feature/production-cutover",
        status: "passed",
      },
    },
  };
}
