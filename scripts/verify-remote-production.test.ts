import { expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import {
  resolveProductionSourceCommit,
  verifyRemoteProduction,
} from "./verify-remote-production.mjs";

const projectRef = "abcdefghijklmnopqrst";
const commitSha = "a".repeat(40);
const environmentFingerprint =
  "d53319153bfd2b1d5a4391e8f6a7fdd5c986c819a9d3bcce34a128a24ca0489a";

test("passes an explicit environment to the read-only Git source resolver", () => {
  const mainSha = "b".repeat(40);
  const environment = { ...process.env, PATH: "git-path-sentinel" };
  const commandRunner = vi.fn().mockReturnValue({
    status: 0,
    stderr: "",
    stdout: `${mainSha}\n`,
  });

  expect(
    resolveProductionSourceCommit("main", environment, commandRunner),
  ).toBe(mainSha);
  expect(commandRunner).toHaveBeenCalledWith(
    "git",
    ["rev-parse", "--verify", "refs/remotes/origin/main^{commit}"],
    { environment },
  );
});

test("verifies production database, deployment, variables and protection read-only", async () => {
  const { input, vercelClient } = fixture();
  const report = await verifyRemoteProduction(input);

  expect(report).toMatchObject({
    commitSha,
    deploymentId: "dpl_Production123",
    environment: "production",
    projectRef,
    status: "passed",
  });
  expect(report.checks).toEqual(
    expect.arrayContaining([
      "extensions",
      "vercel-variables",
      "deployment-ready",
      "stable-alias",
      "no-vercel-protection",
    ]),
  );
  expect(vercelClient.createAutomationBypass).not.toHaveBeenCalled();
});

test("accepts Vercel's explicit none deployment protection", async () => {
  const { input } = fixture({
    project: { ssoProtection: { deploymentType: "none" } },
  });

  await expect(verifyRemoteProduction(input)).resolves.toMatchObject({
    status: "passed",
  });
});

test("verifies an explicit immutable main deployment without changing the manifest", async () => {
  const mainSha = "b".repeat(40);
  const deploymentTarget = {
    commitSha: mainSha,
    deploymentId: "dpl_MainProduction456",
    deploymentUrl: "https://roberto-main-build.vercel.app",
    sourceRef: "main",
  };
  const { input, vercelClient } = fixture({
    deployment: deployment({
      gitSource: { ref: mainSha, repoId: 1264018806, sha: mainSha },
      meta: {
        pr09: "true",
        roberto_commit_sha: mainSha,
        roberto_environment: "production",
        roberto_environment_fingerprint: environmentFingerprint,
        roberto_source_ref: "main",
      },
      uid: deploymentTarget.deploymentId,
      url: "roberto-main-build.vercel.app",
    }),
  });
  const resolveSourceCommit = vi.fn().mockResolvedValue(mainSha);

  await expect(
    verifyRemoteProduction({
      ...input,
      deploymentTarget,
      resolveSourceCommit,
    }),
  ).resolves.toMatchObject({
    commitSha: mainSha,
    deploymentId: deploymentTarget.deploymentId,
    deploymentUrl: deploymentTarget.deploymentUrl,
    sourceRef: "main",
    status: "passed",
  });
  expect(vercelClient.getDeployment).toHaveBeenCalledWith(
    deploymentTarget.deploymentId,
    manifestFixture.vercel.orgId,
  );
  expect(resolveSourceCommit).toHaveBeenCalledWith("main");
});

test("rejects a main deployment whose provider source differs from the explicit release", async () => {
  const mainSha = "b".repeat(40);
  const { input } = fixture({
    deployment: deployment({
      gitSource: { ref: commitSha, repoId: 1264018806, sha: commitSha },
      uid: "dpl_MainProduction456",
      url: "roberto-main-build.vercel.app",
    }),
  });

  await expect(
    verifyRemoteProduction({
      ...input,
      deploymentTarget: {
        commitSha: mainSha,
        deploymentId: "dpl_MainProduction456",
        deploymentUrl: "https://roberto-main-build.vercel.app",
        sourceRef: "main",
      },
      resolveSourceCommit: vi.fn().mockResolvedValue(mainSha),
    }),
  ).rejects.toThrow(/Git source|release/i);
});

test("rejects correct Vercel variable names backed by staging values", async () => {
  const { input } = fixture({
    deployment: deployment({
      meta: {
        pr09: "true",
        roberto_commit_sha: commitSha,
        roberto_environment: "production",
        roberto_environment_fingerprint: "f".repeat(64),
        roberto_source_ref: "feature/production-cutover",
      },
    }),
  });

  await expect(verifyRemoteProduction(input)).rejects.toThrow(
    /environment values|fingerprint/i,
  );
});

test.each([
  [
    "extra variable",
    {
      variables: [
        ...expectedVariables(),
        { key: "EXTRA", target: ["production"], type: "encrypted" },
      ],
    },
    /three.*variables/i,
  ],
  [
    "duplicate variable",
    {
      variables: [
        expectedVariables()[0],
        expectedVariables()[0],
        expectedVariables()[2],
      ],
    },
    /three.*variables/i,
  ],
  [
    "wrong target",
    {
      variables: expectedVariables().map((entry) =>
        entry.key === "SUPABASE_SECRET_KEY"
          ? { ...entry, target: ["preview"] }
          : entry,
      ),
    },
    /three.*variables/i,
  ],
  [
    "deployment pending",
    { deployment: deployment({ readyState: "BUILDING" }) },
    /READY/i,
  ],
  [
    "missing stable alias",
    { deployment: deployment({ alias: [] }) },
    /stable alias/i,
  ],
  [
    "active bypass",
    {
      project: { protectionBypass: { bypass: { scope: "automation-bypass" } } },
    },
    /bypass|protection/i,
  ],
  [
    "SSO protection",
    { project: { ssoProtection: { deploymentType: "all" } } },
    /bypass|protection/i,
  ],
])("rejects production with %s", async (_name, vercelOverride, error) => {
  const { input } = fixture(vercelOverride);
  await expect(verifyRemoteProduction(input)).rejects.toThrow(error);
});

function fixture(vercelOverride: Record<string, unknown> = {}) {
  const manifest = structuredClone(manifestFixture);
  Object.assign(manifest.supabase.targets.production, {
    hostname: `${projectRef}.supabase.co`,
    projectRef,
  });
  Object.assign(manifest.vercel.targets.production, {
    deploymentId: "dpl_Production123",
    deploymentUrl: "https://roberto-production-build.vercel.app",
  });
  const variables =
    (vercelOverride.variables as ReturnType<typeof expectedVariables>) ??
    expectedVariables();
  const selectedDeployment =
    (vercelOverride.deployment as ReturnType<typeof deployment>) ??
    deployment();
  const project = vercelOverride.project ?? {};
  const vercelClient = {
    createAutomationBypass: vi.fn(),
    getDeployment: vi.fn().mockResolvedValue(selectedDeployment),
    getProject: vi.fn().mockResolvedValue({
      id: manifest.vercel.targets.production.projectId,
      name: manifest.vercel.targets.production.projectName,
      protectionBypass: {},
      ssoProtection: null,
      ...project,
    }),
    listProjectEnvironmentVariables: vi
      .fn()
      .mockResolvedValue({ envs: variables }),
  };
  const tables = [
    "profiles",
    "categories",
    "products",
    "stock_movements",
    "cash_sessions",
    "sales",
    "sale_items",
    "payments",
  ];
  const rpcs = [
    "open_cash_session_v3",
    "close_cash_session",
    "finalize_sale_v3",
    "cancel_sale",
    "get_store_sales_report_v2",
  ];
  const managementClient = {
    getAuthConfig: vi.fn().mockResolvedValue({
      disable_signup: true,
      external_anonymous_users_enabled: false,
      external_email_enabled: true,
      password_hibp_enabled: true,
      password_min_length: 14,
      site_url: manifest.vercel.targets.production.siteUrl,
      uri_allow_list: `${manifest.vercel.targets.production.siteUrl}/**`,
    }),
    getDatabaseOpenApi: vi.fn().mockResolvedValue({
      paths: Object.fromEntries([
        ...tables.map((v) => [`/${v}`, {}]),
        ...rpcs.map((v) => [`/rpc/${v}`, {}]),
      ]),
    }),
    runReadOnlyQuery: vi.fn(async (_ref, { query }) => {
      if (query.includes("pg_extension")) return [{ extension_count: 2 }];
      if (query.includes("pg_catalog.pg_class"))
        return [
          {
            table_count: 8,
            rls_enabled_table_count: 8,
            tables_with_policies_count: 8,
          },
        ];
      if (query.includes("policy_contract_matches"))
        return [{ policy_contract_matches: true }];
      if (query.includes("auth.users"))
        return [
          {
            auth_user_count: 1,
            profile_count: 1,
            admin_profile_count: 1,
            non_admin_profile_count: 0,
            profiles_linked_to_auth_count: 1,
          },
        ];
      if (query.includes("operational_row_count"))
        return [{ operational_row_count: 0 }];
      return [
        {
          sales_insert: false,
          sale_items_insert: false,
          payments_insert: false,
        },
      ];
    }),
  };
  return {
    input: {
      anonymousClient: {
        authenticate: vi.fn().mockResolvedValue({ userId: "admin-id" }),
      },
      authenticatedClient: {
        countRows: vi.fn().mockResolvedValue(0),
        getOwnProfile: vi
          .fn()
          .mockResolvedValue({ id: "admin-id", role: "admin" }),
      },
      commandRunner: vi.fn(async (_command, args) => ({
        status: 0,
        stderr: "",
        stdout: args.includes("migration")
          ? "20261002050000 | 20261002050000"
          : "No errors",
      })),
      linkedProjectRef: projectRef,
      localMigrations: ["20261002050000"],
      managementClient,
      manifest,
      expectedVercelEnvironment: {
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-production-sentinel",
        NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
        SUPABASE_SECRET_KEY: "supabase-service-secret-sentinel",
      },
      vercelClient,
    },
    vercelClient,
  };
}

function expectedVariables() {
  return [
    {
      key: "NEXT_PUBLIC_SUPABASE_URL",
      target: ["production"],
      type: "encrypted",
    },
    {
      key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      target: ["production"],
      type: "encrypted",
    },
    { key: "SUPABASE_SECRET_KEY", target: ["production"], type: "sensitive" },
  ];
}

function deployment(override: Record<string, unknown> = {}) {
  return {
    alias: ["roberto-multimarcas-pdv.vercel.app"],
    gitSource: { ref: commitSha, repoId: 1264018806, sha: commitSha },
    name: "roberto-multimarcas-pdv",
    meta: {
      pr09: "true",
      roberto_commit_sha: commitSha,
      roberto_environment: "production",
      roberto_environment_fingerprint: environmentFingerprint,
      roberto_source_ref: "feature/production-cutover",
    },
    readyState: "READY",
    target: "production",
    uid: "dpl_Production123",
    url: "roberto-production-build.vercel.app",
    ...override,
  };
}
