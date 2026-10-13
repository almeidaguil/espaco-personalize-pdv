import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  collectSupabaseInventory,
  createSupabaseInventoryReaders,
} from "./inventory-supabase-project.mjs";
import {
  loadRemoteEnvironmentManifest,
  parseRemoteEnvironmentManifest,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import {
  createProductionBackupEvidence,
  writeProductionBackupEvidence,
} from "./production-backup-evidence.mjs";
import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";

const defaultOutputPath =
  ".provisioning/production-backup/production-backup.json";

/**
 * @param {string[]} argv
 * @param {{
 *   connect?: (input: { environment: any, manifest: any, target: any }) => Promise<any>,
 *   environment?: any,
 *   log?: (value: string) => void,
 *   manifest?: any,
 *   now?: () => Date,
 * }} dependencies
 */
export async function runInventoryProductionCli(
  argv = process.argv.slice(2),
  {
    connect = connectProductionInventoryDependencies,
    environment = process.env,
    log = console.log,
    manifest: providedManifest,
    now = () => new Date(),
  } = {},
) {
  const options = parseArguments(argv);
  if (options.help) {
    log(
      "Uso: npm run ops:inventory-production -- [--output <arquivo>]\nAlvo somente leitura: produção legada ciixpfquwmlsvzleattv",
    );
    return;
  }

  const manifest = providedManifest
    ? parseRemoteEnvironmentManifest(providedManifest)
    : await loadRemoteEnvironmentManifest(
        resolve("config/remote-environments.json"),
      );
  const target = resolveRemoteTarget(manifest, {
    environment: "legacy-production",
    provider: "supabase",
  });
  validateRemoteOperation({
    environment: "legacy-production",
    execute: false,
    manifest,
    operation: "read",
    provider: "supabase",
    target: {
      hostname: target.hostname,
      name: target.name,
      organizationId: target.organizationId,
      projectRef: target.projectRef,
    },
  });

  const dependencies = await connect({ environment, manifest, target });
  assertLegacyProductionProject(dependencies.project, target);
  const inventory = await collectSupabaseInventory({
    ...dependencies,
    now,
  });
  const evidence = createProductionBackupEvidence({
    auth: inventory.auth,
    capturedAt: inventory.capturedAt,
    database: {
      migrations: inventory.migrations,
      schema: inventory.schema,
      tableCounts: inventory.tables,
    },
    recovery: {
      mechanism: "paused-supabase-project",
      migrationDirectory: "supabase/migrations",
      repository: manifest.vercel.repository,
    },
    source: {
      ...inventory.project,
      hostname: target.hostname,
      organizationId: target.organizationId,
    },
    storage: inventory.storage,
  });
  const outputPath = resolve(options.output ?? defaultOutputPath);
  await writeProductionBackupEvidence({ evidence, outputPath });

  const result = {
    capturedAt: evidence.capturedAt,
    outputPath,
    projectRef: target.projectRef,
    sha256: evidence.sha256,
  };
  log(JSON.stringify(result, null, 2));
  return result;
}

function parseArguments(argv) {
  if (argv.includes("--help")) {
    if (argv.length !== 1) throw new Error("--help cannot be combined.");
    return { help: true };
  }
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--output") {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    if (options.output !== undefined) {
      throw new Error("Duplicate --output option.");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value for --output.");
    }
    options.output = value;
    index += 1;
  }
  return options;
}

function assertLegacyProductionProject(project, target) {
  const projectRef = project?.id ?? project?.ref;
  const divergent = [
    ["project ref", projectRef, target.projectRef],
    ["name", project?.name, target.name],
    ["region", project?.region, target.region],
    ["organization", project?.organization_id, target.organizationId],
    [
      "hostname",
      project?.hostname ?? `${projectRef}.supabase.co`,
      target.hostname,
    ],
  ].find(([, actual, expected]) => actual !== expected);
  if (divergent) {
    throw new Error(
      `Legacy production project identity is divergent at ${divergent[0]}.`,
    );
  }
  if (project.status !== "ACTIVE_HEALTHY") {
    throw new Error("Legacy production project is not healthy.");
  }
}

async function connectProductionInventoryDependencies({ environment, target }) {
  const accessToken = environment.SUPABASE_ACCESS_TOKEN;
  if (!accessToken?.trim()) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  }
  const managementClient = createSupabaseManagementClient({ accessToken });
  const project = await managementClient.getProject(target.projectRef);
  const apiKeys = parseSupabaseApiKeys(
    await managementClient.getApiKeys(target.projectRef),
  );
  const supabase = createClient(
    buildSupabaseUrl(target.projectRef),
    apiKeys.secretKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return {
    ...createSupabaseInventoryReaders({
      managementClient,
      projectRef: target.projectRef,
      supabase,
    }),
    managementClient,
    project,
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runInventoryProductionCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Production inventory failed.",
    );
    process.exitCode = 1;
  });
}
