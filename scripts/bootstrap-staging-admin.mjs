import { resolve } from "node:path";
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

export async function bootstrapStagingAdmin({
  confirmation,
  email = undefined,
  environment,
  execute,
  fullName = undefined,
  log,
  manifest,
  password = undefined,
  supabaseAdmin,
}) {
  const credentials = resolveCredentials({
    email,
    environment,
    fullName,
    password,
  });
  const target = resolveStagingTarget(manifest);
  validateRemoteOperation({
    confirmation,
    environment: "staging",
    execute,
    manifest,
    operation: execute ? "mutate" : "read",
    provider: "supabase",
    target,
  });

  const users = await supabaseAdmin.listUsers();
  if (users.length > 1) {
    throw new Error("Bootstrap requires exactly zero or one Auth user.");
  }

  const existingUser = users[0];
  if (
    existingUser &&
    existingUser.email?.toLowerCase() !== credentials.email.toLowerCase()
  ) {
    throw new Error("A different Auth user already exists in staging.");
  }

  if (!execute) {
    const result = {
      action: existingUser ? "verify-admin" : "create-admin",
      mode: "dry-run",
      projectRef: target.projectRef,
      userCount: users.length,
    };
    log(result);
    return result;
  }

  if (existingUser) {
    const profile = await supabaseAdmin.getProfile(existingUser.id);
    if (!isCompatibleProfile(profile, existingUser.id, credentials)) {
      throw new Error(
        "The existing staging user has an incompatible admin profile.",
      );
    }

    const result = {
      action: "unchanged",
      mode: "executed",
      projectRef: target.projectRef,
      userCount: 1,
    };
    log(result);
    return result;
  }

  let createdUser;
  try {
    createdUser = await supabaseAdmin.createUser({
      email: credentials.email,
      email_confirm: true,
      password: credentials.password,
      user_metadata: { full_name: credentials.fullName, role: "admin" },
    });
  } catch {
    throw new Error("Unable to create the staging administrator.");
  }

  await supabaseAdmin.getProfile(createdUser.id);
  await supabaseAdmin.upsertProfile({
    email: credentials.email,
    full_name: credentials.fullName,
    id: createdUser.id,
    role: "admin",
  });

  const result = {
    action: "created",
    mode: "executed",
    projectRef: target.projectRef,
    userCount: 1,
  };
  log(result);
  return result;
}

function resolveCredentials({ email, environment, fullName, password }) {
  const values = {
    email: email ?? environment.STAGING_ADMIN_EMAIL,
    fullName: fullName ?? environment.STAGING_ADMIN_FULL_NAME,
    password: password ?? environment.STAGING_ADMIN_PASSWORD,
  };
  const missing = [
    ["STAGING_ADMIN_EMAIL", values.email],
    ["STAGING_ADMIN_PASSWORD", values.password],
    ["STAGING_ADMIN_FULL_NAME", values.fullName],
  ]
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(", ")}.`);
  }
  if (values.password.length < 14) {
    throw new Error("Staging admin password must have at least 14 characters.");
  }
  if (
    !/[a-z]/.test(values.password) ||
    !/[A-Z]/.test(values.password) ||
    !/[0-9]/.test(values.password) ||
    !/[^A-Za-z0-9]/.test(values.password)
  ) {
    throw new Error("Staging admin requires a strong password.");
  }

  const e2eValues = Object.entries(environment)
    .filter(([name]) => /^E2E_.+_(EMAIL|PASSWORD)$/.test(name))
    .map(([, value]) => value)
    .filter(Boolean);
  if (
    /e2e/i.test(values.email) ||
    e2eValues.some(
      (value) =>
        value === values.password ||
        value.toLowerCase() === values.email.toLowerCase(),
    )
  ) {
    throw new Error("Local E2E credentials cannot be used in remote staging.");
  }

  return values;
}

function resolveStagingTarget(manifest) {
  const target = manifest.supabase.targets.staging;
  if (!target.projectRef || !target.hostname) {
    throw new Error(
      "The staging project ref must be persisted before bootstrap.",
    );
  }
  return {
    hostname: target.hostname,
    name: target.name,
    organizationId: manifest.supabase.organization.id,
    projectRef: target.projectRef,
  };
}

function isCompatibleProfile(profile, userId, credentials) {
  return Boolean(
    profile &&
    profile.id === userId &&
    profile.email?.toLowerCase() === credentials.email.toLowerCase() &&
    profile.full_name === credentials.fullName &&
    profile.role === "admin",
  );
}

function createSupabaseAdminAdapter(supabase) {
  return {
    async createUser(input) {
      const { data, error } = await supabase.auth.admin.createUser(input);
      if (error || !data.user) throw new Error("Create user failed.");
      return data.user;
    },
    async getProfile(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error("Profile lookup failed.");
      return data;
    },
    async listUsers() {
      const users = [];
      for (let page = 1; ; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage: 100,
        });
        if (error) throw new Error("Auth user listing failed.");
        users.push(...data.users);
        if (data.users.length < 100) return users;
      }
    },
    async upsertProfile(profile) {
      const { error } = await supabase.from("profiles").upsert(profile);
      if (error) throw new Error("Profile reconciliation failed.");
      return profile;
    },
  };
}

export async function runBootstrapStagingAdminCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    console.log(
      "Uso: npm run ops:bootstrap-staging-admin -- [--execute --confirm-ref <staging-ref>]",
    );
    return;
  }
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const projectRef = manifest.supabase.targets.staging.projectRef;
  if (!projectRef)
    throw new Error("The staging project ref is not registered.");
  if (!environment.SUPABASE_ACCESS_TOKEN) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  }
  const managementClient = createSupabaseManagementClient({
    accessToken: environment.SUPABASE_ACCESS_TOKEN,
  });
  const keys = parseSupabaseApiKeys(
    await managementClient.getApiKeys(projectRef),
  );
  const supabase = createClient(buildSupabaseUrl(projectRef), keys.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return bootstrapStagingAdmin({
    confirmation: readOption(argv, "--confirm-ref"),
    environment,
    execute: argv.includes("--execute"),
    log: (value) => console.log(JSON.stringify(value, null, 2)),
    manifest,
    supabaseAdmin: createSupabaseAdminAdapter(supabase),
  });
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runBootstrapStagingAdminCli().catch((error) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed.");
    process.exitCode = 1;
  });
}
