import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  loadRemoteEnvironmentManifest,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";

const legacyStagingRef = "gpywbeoqcovjrfnmbdqx";
const operationalTables = [
  "profiles",
  "categories",
  "products",
  "stock_movements",
  "cash_sessions",
  "sales",
  "sale_items",
  "payments",
];

export async function collectSupabaseInventory({
  authReader,
  databaseReader,
  managementClient,
  now,
  project,
  storageReader,
}) {
  const projectRef = project.id ?? project.ref;
  const tables = Object.fromEntries(
    await Promise.all(
      operationalTables.map(async (table) => {
        try {
          return [table, await databaseReader.countRows(table)];
        } catch {
          throw new Error(`Unable to count table ${table}.`);
        }
      }),
    ),
  );

  let migrations;
  try {
    migrations = [...(await databaseReader.listMigrations())].sort();
  } catch {
    throw new Error("Unable to list known migrations.");
  }

  let users;
  try {
    users = await authReader.listUsers();
  } catch {
    throw new Error("Unable to aggregate Auth users.");
  }

  let authConfiguration;
  try {
    authConfiguration = await managementClient.getAuthConfig(projectRef);
  } catch {
    throw new Error("Unable to read the public Auth configuration.");
  }

  let buckets;
  try {
    const rawBuckets = await storageReader.listBuckets();
    buckets = await Promise.all(
      rawBuckets.map(async (bucket) => {
        const objects = await storageReader.listObjects(bucket.id);
        return {
          name: bucket.name,
          objectCount: objects.length,
          totalBytes: objects.reduce(
            (total, object) => total + Number(object.metadata?.size ?? 0),
            0,
          ),
        };
      }),
    );
  } catch {
    throw new Error("Unable to aggregate Storage buckets.");
  }

  return {
    auth: {
      configuration: pickPublicAuthConfiguration(authConfiguration),
      usersByRole: countUsersByRole(users),
    },
    capturedAt: now().toISOString(),
    migrations,
    project: {
      databaseVersion: project.database?.version,
      name: project.name,
      projectRef,
      region: project.region,
      status: project.status,
    },
    storage: { buckets },
    tables,
  };
}

function countUsersByRole(users) {
  return users.reduce((counts, user) => {
    const role = ["admin", "operator"].includes(user.user_metadata?.role)
      ? user.user_metadata.role
      : "unknown";
    counts[role] = (counts[role] ?? 0) + 1;
    return counts;
  }, {});
}

function pickPublicAuthConfiguration(configuration) {
  return {
    disableSignup: configuration.disable_signup,
    emailEnabled: configuration.external_email_enabled,
    leakedPasswordProtectionEnabled: configuration.password_hibp_enabled,
    minimumPasswordLength: configuration.password_min_length,
    anonymousUsersEnabled: configuration.external_anonymous_users_enabled,
    siteUrl: configuration.site_url,
  };
}

export async function collectDeploymentDependencies({
  githubReader,
  vercelReader,
}) {
  const [repository, workflows, vercelProject] = await Promise.all([
    githubReader.getRepository(),
    githubReader.listWorkflows(),
    vercelReader.getProject(),
  ]);

  return {
    github: {
      defaultBranch: repository.defaultBranchRef?.name,
      nameWithOwner: repository.nameWithOwner,
      url: repository.url,
      visibility: repository.visibility,
      workflows: workflows.map(({ name, path }) => ({ name, path })),
    },
    vercel: {
      framework: vercelProject.framework,
      id: vercelProject.id,
      name: vercelProject.name,
      repository: vercelProject.repository,
    },
  };
}

export async function writeInventoryEvidence({
  inventory,
  privateDirectory,
  publicFile,
}) {
  const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
  const sha256 = createHash("sha256").update(serialized).digest("hex");
  await mkdir(privateDirectory, { recursive: true });
  await mkdir(dirname(publicFile), { recursive: true });
  await writeFile(resolve(privateDirectory, "inventory.json"), serialized, {
    encoding: "utf8",
    mode: 0o600,
  });
  await writeFile(publicFile, buildPublicSummary(inventory, sha256), "utf8");

  return { capturedAt: inventory.capturedAt, sha256 };
}

function buildPublicSummary(inventory, sha256) {
  const tableLines = Object.entries(inventory.tables ?? {})
    .map(([table, count]) => `- ${table}: ${count}`)
    .join("\n");

  return `# Inventário redigido do staging legado

- Capturado em: ${inventory.capturedAt}
- Project ref: ${inventory.project.projectRef}
- Nome: ${inventory.project.name}
- Região: ${inventory.project.region}
- Estado: ${inventory.project.status}
- SHA-256 da evidência privada: ${sha256}

## Contagens

${tableLines || "- Nenhuma tabela registrada."}
`;
}

export async function runInventoryCli(
  argv = process.argv.slice(2),
  { connect = connectInventoryDependencies, log = console.log } = {},
) {
  if (argv.includes("--help")) {
    log(
      `Uso: npm run ops:inventory-staging -- [--output <arquivo>]\nAlvo somente leitura: staging legado ${legacyStagingRef}`,
    );
    return;
  }

  const output =
    readOption(argv, "--output") ?? ".provisioning/inventory/public-summary.md";
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const expected = manifest.supabase.legacy.staging;
  validateRemoteOperation({
    environment: "legacy-staging",
    execute: false,
    manifest,
    operation: "read",
    provider: "supabase",
    target: {
      hostname: expected.hostname,
      name: expected.name,
      organizationId: manifest.supabase.organization.id,
      projectRef: expected.projectRef,
    },
  });

  const dependencies = await connect({ manifest });
  const inventory = await collectSupabaseInventory({
    ...dependencies,
    now: () => new Date(),
  });
  const deploymentDependencies =
    await collectDeploymentDependencies(dependencies);
  const completeInventory = {
    ...inventory,
    dependencies: deploymentDependencies,
  };
  const evidence = await writeInventoryEvidence({
    inventory: completeInventory,
    privateDirectory: resolve(".provisioning/inventory"),
    publicFile: resolve(output),
  });

  log(
    JSON.stringify(
      {
        capturedAt: evidence.capturedAt,
        projectRef: expected.projectRef,
        publicFile: output,
        sha256: evidence.sha256,
      },
      null,
      2,
    ),
  );
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}.`);
  }
  return value;
}

async function connectInventoryDependencies({ manifest }) {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken?.trim()) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  }

  const managementClient = createSupabaseManagementClient({ accessToken });
  const projectRef = manifest.supabase.legacy.staging.projectRef;
  const project = await managementClient.getProject(projectRef);
  const apiKeys = parseSupabaseApiKeys(
    await managementClient.getApiKeys(projectRef),
  );
  const supabase = createClient(
    buildSupabaseUrl(projectRef),
    apiKeys.secretKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return {
    authReader: createAuthReader(supabase),
    databaseReader: createDatabaseReader(supabase),
    githubReader: createKnownGitHubReader(manifest),
    managementClient,
    project,
    storageReader: createStorageReader(supabase),
    vercelReader: createKnownVercelReader(manifest),
  };
}

function createDatabaseReader(supabase) {
  return {
    async countRows(table) {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      if (error) throw new Error("Count failed.");
      return count ?? 0;
    },
    async listMigrations() {
      const files = await readdir(resolve("supabase/migrations"));
      return files.filter((file) => file.endsWith(".sql"));
    },
  };
}

function createAuthReader(supabase) {
  return {
    async listUsers() {
      const users = [];
      for (let page = 1; ; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: 100,
        });
        if (error) throw new Error("Auth listing failed.");
        users.push(...data.users);
        if (data.users.length < 100) return users;
      }
    },
  };
}

function createStorageReader(supabase) {
  return {
    async listBuckets() {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error("Bucket listing failed.");
      return data;
    },
    async listObjects(bucketId) {
      const objects = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await supabase.storage
          .from(bucketId)
          .list("", { limit: 100, offset });
        if (error) throw new Error("Object listing failed.");
        objects.push(...data);
        if (data.length < 100) return objects;
      }
    },
  };
}

function createKnownGitHubReader(manifest) {
  return {
    async getRepository() {
      return {
        defaultBranchRef: { name: "main" },
        nameWithOwner: manifest.vercel.repository,
        url: `https://github.com/${manifest.vercel.repository}`,
        visibility: "PUBLIC",
      };
    },
    async listWorkflows() {
      const files = await readdir(resolve(".github/workflows"));
      return files.map((file) => ({
        name: file.replace(/\.(yml|yaml)$/i, ""),
        path: `.github/workflows/${file}`,
      }));
    },
  };
}

function createKnownVercelReader(manifest) {
  return {
    async getProject() {
      return {
        framework: "nextjs",
        id: manifest.vercel.projectId,
        name: manifest.vercel.projectName,
        repository: manifest.vercel.repository,
      };
    },
  };
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runInventoryCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Inventory collection failed.",
    );
    process.exitCode = 1;
  });
}
