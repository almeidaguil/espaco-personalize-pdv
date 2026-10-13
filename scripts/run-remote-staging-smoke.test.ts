import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { runManagedRemoteStagingSmoke } from "./run-remote-staging-smoke.mjs";

const bypassSecret = "0123456789abcdef0123456789abcdef";
const stagingTarget = manifestFixture.vercel.targets.staging;

describe("runManagedRemoteStagingSmoke", () => {
  test("creates one temporary bypass, runs the smoke and removes it", async () => {
    const protectionClient = createProtectionClient();
    const runCommand = vi.fn().mockReturnValue(ok());

    await expect(
      runManagedRemoteStagingSmoke({
        args: executeArguments(),
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient,
        runCommand,
        secretGenerator: () => bypassSecret,
      }),
    ).resolves.toEqual({ bypassesAfter: 0, smokeStatus: "passed" });

    expect(protectionClient.createAutomationBypass).toHaveBeenCalledWith({
      orgId: manifestFixture.vercel.orgId,
      projectId: stagingTarget.projectId,
      secret: bypassSecret,
    });
    expect(protectionClient.revokeAutomationBypass).toHaveBeenCalledWith({
      orgId: manifestFixture.vercel.orgId,
      projectId: stagingTarget.projectId,
      secret: bypassSecret,
    });
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand.mock.calls[0][1]).toEqual([
      "run",
      "test:e2e:staging-smoke:raw",
    ]);
    expect(runCommand.mock.calls[0][2].environment).toMatchObject({
      VERCEL_AUTOMATION_BYPASS_SECRET: bypassSecret,
    });
    expect(runCommand.mock.calls[0][2].environment).not.toHaveProperty(
      "VERCEL_TOKEN",
    );
  });

  test("cleans the temporary bypass when the smoke fails", async () => {
    const protectionClient = createProtectionClient();
    const runCommand = vi
      .fn()
      .mockReturnValue({ status: 1, stderr: "smoke failed", stdout: "" });

    await expect(
      runManagedRemoteStagingSmoke({
        args: executeArguments(),
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient,
        runCommand,
        secretGenerator: () => bypassSecret,
      }),
    ).rejects.toThrow(/remote staging smoke failed/i);

    expect(protectionClient.revokeAutomationBypass).toHaveBeenCalledWith(
      expect.objectContaining({ secret: bypassSecret }),
    );
  });

  test("refuses to run when a bypass is already active", async () => {
    const protectionClient = createProtectionClient({ initiallyEmpty: false });

    await expect(
      runManagedRemoteStagingSmoke({
        args: executeArguments(),
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient,
        runCommand: vi.fn(),
        secretGenerator: () => bypassSecret,
      }),
    ).rejects.toThrow(/already active/i);

    expect(protectionClient.createAutomationBypass).not.toHaveBeenCalled();
  });

  test("is dry-run by default and requires literal project confirmation", async () => {
    const protectionClient = createProtectionClient();
    await expect(
      runManagedRemoteStagingSmoke({
        args: [],
        environment: {},
        manifest: manifestFixture,
        protectionClient,
        runCommand: vi.fn(),
      }),
    ).resolves.toMatchObject({ mode: "dry-run" });
    expect(protectionClient.getProject).not.toHaveBeenCalled();

    await expect(
      runManagedRemoteStagingSmoke({
        args: ["--execute", "--confirm-project", "wrong-project"],
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient,
        runCommand: vi.fn(),
      }),
    ).rejects.toThrow(/confirmação literal/i);
  });

  test("requires Vercel Authentication and cleans up if post-create inspection fails", async () => {
    const ssoDisabled = createProtectionClient({ ssoEnabled: false });
    await expect(
      runManagedRemoteStagingSmoke({
        args: executeArguments(),
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient: ssoDisabled,
        runCommand: vi.fn(),
        secretGenerator: () => bypassSecret,
      }),
    ).rejects.toThrow(/Vercel Authentication/i);

    const inspectionFailure = createProtectionClient({ failSecondRead: true });
    await expect(
      runManagedRemoteStagingSmoke({
        args: executeArguments(),
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient: inspectionFailure,
        runCommand: vi.fn(),
        secretGenerator: () => bypassSecret,
      }),
    ).rejects.toThrow(/inspect the created Vercel bypass/i);
    expect(inspectionFailure.revokeAutomationBypass).toHaveBeenCalledWith(
      expect.objectContaining({ secret: bypassSecret }),
    );
  });

  test("accepts a revoke response failure only when final state proves zero bypasses", async () => {
    const protectionClient = createProtectionClient({ revokeRejects: true });

    await expect(
      runManagedRemoteStagingSmoke({
        args: executeArguments(),
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient,
        runCommand: vi.fn().mockReturnValue(ok()),
        secretGenerator: () => bypassSecret,
      }),
    ).resolves.toEqual({ bypassesAfter: 0, smokeStatus: "passed" });
  });

  test("rejects a bypass secret outside Vercel's 32-character contract", async () => {
    const protectionClient = createProtectionClient();
    await expect(
      runManagedRemoteStagingSmoke({
        args: executeArguments(),
        environment: validEnvironment(),
        manifest: manifestFixture,
        protectionClient,
        runCommand: vi.fn(),
        secretGenerator: () => "invalid-secret",
      }),
    ).rejects.toThrow(/generate a temporary Vercel bypass/i);
    expect(protectionClient.createAutomationBypass).not.toHaveBeenCalled();
  });
});

function executeArguments() {
  return ["--execute", "--confirm-project", stagingTarget.projectId];
}

function validEnvironment() {
  return {
    E2E_BASE_URL: stagingTarget.siteUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-sentinel",
    NEXT_PUBLIC_SUPABASE_URL: `https://${manifestFixture.supabase.targets.staging.projectRef}.supabase.co`,
    STAGING_ADMIN_EMAIL: "owner@roberto-multimarcas.test",
    STAGING_ADMIN_PASSWORD: "Strong-staging-password-2026!",
    VERCEL_TOKEN: "vercel-token-sentinel",
  };
}

function createProtectionClient({
  failSecondRead = false,
  initiallyEmpty = true,
  revokeRejects = false,
  ssoEnabled = true,
} = {}) {
  let readCount = 0;
  return {
    createAutomationBypass: vi.fn().mockResolvedValue({
      protectionBypass: {
        [bypassSecret]: { scope: "automation-bypass" },
      },
    }),
    getProject: vi.fn().mockImplementation(() => {
      readCount += 1;
      if (readCount === 2 && failSecondRead) {
        return Promise.reject(new Error("inspection unavailable"));
      }
      return Promise.resolve({
        protectionBypass:
          readCount === 1 && !initiallyEmpty
            ? { existing: { scope: "automation-bypass" } }
            : readCount === 2
              ? { [bypassSecret]: { scope: "automation-bypass" } }
              : {},
        ssoProtection: ssoEnabled
          ? { deploymentType: "all_except_custom_domains" }
          : null,
      });
    }),
    revokeAutomationBypass: revokeRejects
      ? vi.fn().mockRejectedValue(new Error("ambiguous API response"))
      : vi.fn().mockResolvedValue({ protectionBypass: {} }),
  };
}

function ok() {
  return { status: 0, stderr: "", stdout: "" };
}
