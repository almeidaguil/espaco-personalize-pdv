import { readFile } from "node:fs/promises";

import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import { runNetlifyProvisioning } from "./provision-netlify-site.mjs";

const accountId = "11111111-1111-4111-8111-111111111111";
const siteId = "22222222-2222-4222-8222-222222222222";
const authToken = "netlify-auth-token-sentinel";
const projectRef = "qrstabcdefghijklmnop";
const publishableKey = "publishable-key-sentinel";
const secretKey = "secret-key-sentinel";

describe("Netlify configuration", () => {
  test("pins the official build without a publish directory or secrets", async () => {
    const config = await readFile("netlify.toml", "utf8");

    expect(config).toContain('command = "npm run build"');
    expect(config).toContain('NODE_VERSION = "22.23.2"');
    expect(config).toContain('NPM_VERSION = "10.9.8"');
    expect(config).toContain("[context.deploy-preview]");
    expect(config).toContain("[context.branch-deploy]");
    expect(config).not.toMatch(/^\s*publish\s*=/m);
    expect(config).not.toMatch(/SUPABASE|TOKEN|SECRET_KEY/);
  });
});

describe("runNetlifyProvisioning", () => {
  test("rejects an invalid or missing phase", async () => {
    await expect(run({ args: [] })).rejects.toThrow(/phase/i);
    await expect(run({ args: ["--phase", "production"] })).rejects.toThrow(
      /phase/i,
    );
  });

  test("returns a site dry-run without credentials or mutations", async () => {
    const netlifyClient = createNetlifyClient();
    const commandRunner = createCommandRunner();

    const result = await run({
      args: ["--phase", "site"],
      environment: {},
      netlifyClient,
      commandRunner,
    });

    expect(result).toMatchObject({
      accountId: null,
      mode: "dry-run",
      productionBranch: "netlify-production-disabled-pr09",
      repository: "almeidaguil/espaco-personalize-pdv",
      siteId: null,
      siteName: "roberto-multimarcas-pdv",
      siteUrl: "https://roberto-multimarcas-pdv.netlify.app",
      stagingBranch: "develop",
    });
    expect(netlifyClient.createSite).not.toHaveBeenCalled();
    expect(netlifyClient.updateSite).not.toHaveBeenCalled();
    expect(commandRunner).not.toHaveBeenCalled();
  });

  test("requires the exact confirmation and approved account", async () => {
    await expect(
      run({
        args: ["--phase", "site", "--execute", "--confirm-site", "wrong"],
      }),
    ).rejects.toThrow(/confirmação literal/i);

    const netlifyClient = createNetlifyClient({
      account: { id: "different-account", slug: "different" },
    });
    await expect(executeSite({ netlifyClient })).rejects.toThrow(
      /account.*divergent/i,
    );
    expect(netlifyClient.createSite).not.toHaveBeenCalled();
  });

  test("stops when the approved site name is unavailable", async () => {
    const netlifyClient = createNetlifyClient({
      sites: [validSite({ account_id: "different-account" })],
    });

    await expect(executeSite({ netlifyClient })).rejects.toThrow(
      /site name.*unavailable/i,
    );
    expect(netlifyClient.createSite).not.toHaveBeenCalled();
  });

  test("creates, links, and proves the non-production site configuration", async () => {
    const events: string[] = [];
    const netlifyClient = createNetlifyClient({ events });
    const commandRunner = createCommandRunner(events);

    const result = await executeSite({ commandRunner, netlifyClient });

    expect(netlifyClient.createSite).toHaveBeenCalledWith("owner", {
      name: "roberto-multimarcas-pdv",
      prevent_non_git_prod_deploys: true,
    });
    expect(netlifyClient.updateSite).toHaveBeenCalledWith(siteId, {
      prevent_non_git_prod_deploys: true,
      repo: {
        allowed_branches: ["develop"],
        cmd: "npm run build",
        provider: "github",
        public_repo: true,
        repo_branch: "netlify-production-disabled-pr09",
        repo_path: "almeidaguil/espaco-personalize-pdv",
        repo_url: "https://github.com/almeidaguil/espaco-personalize-pdv",
        stop_builds: false,
      },
    });
    expect(commandRunner.mock.calls[0][0]).toBe("npx.cmd");
    expect(commandRunner.mock.calls[0][1]).toEqual([
      "--yes",
      "netlify-cli@27.11.2",
      "link",
      "--id",
      siteId,
    ]);
    expect(commandRunner.mock.calls.flat().join(" ")).not.toContain("--prod");
    expect(events).toEqual(["create", "update", "link", "get"]);
    expect(result).toMatchObject({ accountId, mode: "executed", siteId });
    expect(JSON.stringify(result)).not.toContain(authToken);
  });

  test.each([
    ["site", validSite({ name: "wrong-site" })],
    [
      "repository",
      validSite({
        build_settings: validBuildSettings({ repo_path: "wrong/repo" }),
      }),
    ],
    [
      "production branch",
      validSite({
        build_settings: validBuildSettings({ repo_branch: "main" }),
      }),
    ],
  ])("rejects a divergent existing %s", async (_name, site) => {
    const manifest = provisionedManifest();
    const netlifyClient = createNetlifyClient({ site, sites: [site] });

    await expect(executeSite({ manifest, netlifyClient })).rejects.toThrow(
      /divergent|production.*blocked/i,
    );
    expect(netlifyClient.updateSite).not.toHaveBeenCalled();
  });

  test("requires a persisted site and all staging variables", async () => {
    await expect(
      run({ args: ["--phase", "configure-staging"] }),
    ).rejects.toThrow(/site.*persisted/i);

    await expect(
      run({
        args: ["--phase", "configure-staging"],
        manifest: provisionedManifest(),
      }),
    ).rejects.toThrow(/staging variables/i);
  });

  test("rejects production Supabase credentials", async () => {
    const manifest = provisionedManifest();
    await expect(
      run({
        args: ["--phase", "configure-staging"],
        environment: stagingEnvironment({
          NEXT_PUBLIC_SUPABASE_URL: `https://${manifest.supabase.legacy.production.projectRef}.supabase.co`,
        }),
        manifest,
      }),
    ).rejects.toThrow(/production.*credential/i);
  });

  test("configures only secret staging contexts and creates a draft deploy", async () => {
    const events: string[] = [];
    const manifest = provisionedManifest();
    const netlifyClient = createNetlifyClient({ events });
    const commandRunner = createCommandRunner(events, {
      stdout: JSON.stringify({ deploy_id: "draft-deploy-id" }),
    });

    const result = await run({
      args: [
        "--phase",
        "configure-staging",
        "--execute",
        "--confirm-site",
        manifest.netlify.siteName,
      ],
      commandRunner,
      environment: stagingEnvironment(),
      manifest,
      netlifyClient,
    });

    expect(netlifyClient.upsertSiteEnvironmentVariables).toHaveBeenCalledWith({
      accountId,
      branch: "develop",
      siteId,
      variables: {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
        SUPABASE_SECRET_KEY: secretKey,
      },
    });
    const deployArgs = commandRunner.mock.calls[0][1];
    expect(deployArgs.slice(0, 2)).toEqual(["--yes", "netlify-cli@27.11.2"]);
    expect(deployArgs).toContain("--context");
    expect(deployArgs).toContain("branch-deploy");
    expect(deployArgs).not.toContain("--prod");
    expect(result).toMatchObject({
      deployId: "draft-deploy-id",
      mode: "executed",
    });
    expect(JSON.stringify(result)).not.toContain(secretKey);
    expect(JSON.stringify(deployArgs)).not.toContain(secretKey);
  });

  test("redacts provider errors and refuses unproved production blocking", async () => {
    const manifest = provisionedManifest();
    const divergent = validSite({ prevent_non_git_prod_deploys: false });
    const netlifyClient = createNetlifyClient({ site: divergent });

    await expect(
      run({
        args: [
          "--phase",
          "configure-staging",
          "--execute",
          "--confirm-site",
          manifest.netlify.siteName,
        ],
        environment: stagingEnvironment(),
        manifest,
        netlifyClient,
      }),
    ).rejects.toThrow(/production.*blocked/i);
    expect(netlifyClient.upsertSiteEnvironmentVariables).not.toHaveBeenCalled();

    const failingClient = createNetlifyClient();
    failingClient.upsertSiteEnvironmentVariables.mockRejectedValue(
      new Error(`${authToken} ${secretKey}`),
    );
    let message = "";
    try {
      await run({
        args: [
          "--phase",
          "configure-staging",
          "--execute",
          "--confirm-site",
          manifest.netlify.siteName,
        ],
        environment: stagingEnvironment(),
        manifest,
        netlifyClient: failingClient,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).not.toContain(authToken);
    expect(message).not.toContain(secretKey);
  });
});

function run({
  args = [
    "--phase",
    "site",
    "--execute",
    "--confirm-site",
    "roberto-multimarcas-pdv",
  ],
  commandRunner = createCommandRunner(),
  environment = {
    NETLIFY_ACCOUNT_ID: accountId,
    NETLIFY_AUTH_TOKEN: authToken,
  },
  manifest = parseRemoteEnvironmentManifest(manifestFixture),
  netlifyClient = createNetlifyClient(),
}: RunOptions = {}) {
  return runNetlifyProvisioning({
    args,
    commandRunner,
    environment,
    log: vi.fn(),
    manifest,
    netlifyClient,
  });
}

function executeSite(overrides: RunOptions = {}) {
  return run(overrides);
}

type CommandRunner = ReturnType<typeof createCommandRunner>;
type RunOptions = {
  args?: string[];
  commandRunner?: CommandRunner;
  environment?: Record<string, string>;
  manifest?: ReturnType<typeof parseRemoteEnvironmentManifest>;
  netlifyClient?: ReturnType<typeof createNetlifyClient>;
};

function createCommandRunner(
  events: string[] = [],
  resultOverrides: Partial<CommandResult> = {},
) {
  const result = { status: 0, stderr: "", stdout: "{}", ...resultOverrides };
  return vi.fn(
    async (
      _command: string,
      args: string[],
      options: { environment: Record<string, string> },
    ) => {
      events.push(args.includes("link") ? "link" : "deploy");
      expect(options.environment.NETLIFY_AUTH_TOKEN).toBe(authToken);
      return result;
    },
  );
}

type CommandResult = { status: number; stderr: string; stdout: string };

function createNetlifyClient({
  account = { id: accountId, slug: "owner" },
  events = [],
  site = validSite(),
  sites = [],
}: {
  account?: Record<string, unknown>;
  events?: string[];
  site?: ReturnType<typeof validSite>;
  sites?: ReturnType<typeof validSite>[];
} = {}) {
  return {
    createSite: vi.fn(async () => {
      events.push("create");
      return site;
    }),
    getAccount: vi.fn().mockResolvedValue(account),
    getSite: vi.fn(async () => {
      events.push("get");
      return site;
    }),
    listSites: vi.fn().mockResolvedValue(sites),
    updateSite: vi.fn(async () => {
      events.push("update");
      return site;
    }),
    upsertSiteEnvironmentVariables: vi.fn().mockResolvedValue({
      keys: [
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
      ],
      updated: 3,
    }),
  };
}

function validBuildSettings(overrides: Record<string, unknown> = {}) {
  return {
    allowed_branches: ["develop"],
    cmd: "npm run build",
    provider: "github",
    public_repo: true,
    repo_branch: "netlify-production-disabled-pr09",
    repo_path: "almeidaguil/espaco-personalize-pdv",
    repo_url: "https://github.com/almeidaguil/espaco-personalize-pdv",
    stop_builds: false,
    ...overrides,
  };
}

function validSite(overrides: Record<string, unknown> = {}) {
  return {
    account_id: accountId,
    build_settings: validBuildSettings(),
    id: siteId,
    name: "roberto-multimarcas-pdv",
    prevent_non_git_prod_deploys: true,
    ssl_url: "https://roberto-multimarcas-pdv.netlify.app",
    url: "https://roberto-multimarcas-pdv.netlify.app",
    ...overrides,
  };
}

function provisionedManifest() {
  return parseRemoteEnvironmentManifest({
    ...manifestFixture,
    netlify: { ...manifestFixture.netlify, accountId, siteId },
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
  });
}

function stagingEnvironment(overrides: Record<string, string> = {}) {
  return {
    NETLIFY_AUTH_TOKEN: authToken,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    SUPABASE_SECRET_KEY: secretKey,
    ...overrides,
  };
}
