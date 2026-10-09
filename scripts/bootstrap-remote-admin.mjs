import {
  redactSensitiveText,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

const operationalTables = [
  "categories",
  "products",
  "stock_movements",
  "cash_sessions",
  "sales",
  "sale_items",
  "payments",
];

export async function bootstrapRemoteAdmin({
  adminApi,
  confirmation,
  credentials,
  environment,
  execute,
  logger = () => {},
  manifest,
  requireEmptyOperationalData = environment === "production",
  sensitiveValues = /** @type {string[]} */ ([]),
}) {
  const validatedCredentials = validateCredentials(credentials, environment);
  const target = resolveRemoteTarget(manifest, {
    environment,
    provider: "supabase",
  });
  if (!target.projectRef || !target.hostname) {
    throw new Error(`The ${environment} project ref must be persisted.`);
  }
  validateRemoteOperation({
    confirmation,
    environment,
    execute,
    manifest,
    operation: execute ? "mutate" : "read",
    provider: "supabase",
    target: {
      hostname: target.hostname,
      name: target.name,
      organizationId: target.organizationId,
      projectRef: target.projectRef,
    },
  });

  let users = await adminApi.listUsers();
  assertUserSet(users, validatedCredentials, environment);
  const existingUser = users[0];
  if (!execute) {
    const result = {
      created: false,
      environment,
      role: "admin",
      userId: existingUser?.id ?? null,
    };
    logger(result);
    return result;
  }

  let user = existingUser;
  let created = false;
  if (user) {
    const profile = await adminApi.getProfile(user.id);
    if (!isCompatibleProfile(profile, user.id, validatedCredentials)) {
      throw new Error(
        `The existing ${environment} user has an incompatible admin profile.`,
      );
    }
  } else {
    try {
      user = await adminApi.createUser({
        email: validatedCredentials.email,
        email_confirm: true,
        password: validatedCredentials.password,
        user_metadata: {
          full_name: validatedCredentials.fullName,
          role: "admin",
        },
      });
    } catch (error) {
      redactSensitiveText(error, [
        validatedCredentials.email,
        validatedCredentials.password,
        ...sensitiveValues,
      ]);
      throw new Error(`Unable to create the ${environment} administrator.`);
    }
    await adminApi.getProfile(user.id);
    await adminApi.upsertProfile({
      email: validatedCredentials.email,
      full_name: validatedCredentials.fullName,
      id: user.id,
      role: "admin",
    });
    created = true;
  }

  const profile = await adminApi.getProfile(user.id);
  if (!isCompatibleProfile(profile, user.id, validatedCredentials)) {
    throw new Error(`The ${environment} admin postcondition is divergent.`);
  }

  if (requireEmptyOperationalData) {
    users = await adminApi.listUsers();
    assertUserSet(users, validatedCredentials, environment);
    if (users.length !== 1 || users[0].id !== user.id) {
      throw new Error(`The ${environment} admin postcondition is divergent.`);
    }
    if (typeof adminApi.getPostcondition !== "function") {
      throw new Error("Production admin postcondition reader is required.");
    }
    const postcondition = await adminApi.getPostcondition();
    if (
      postcondition?.adminCount !== 1 ||
      postcondition?.operatorCount !== 0 ||
      postcondition?.operationalRowCount !== 0
    ) {
      throw new Error("Production admin postcondition is divergent.");
    }
  }

  const result = { created, environment, role: "admin", userId: user.id };
  logger(result);
  return result;
}

export function createRemoteAdminAdapter(supabase) {
  return {
    async createUser(input) {
      const { data, error } = await supabase.auth.admin.createUser(input);
      if (error || !data.user) throw new Error("Create user failed.");
      return data.user;
    },
    async getPostcondition() {
      const [adminCount, operatorCount, ...counts] = await Promise.all([
        countRows(supabase, "profiles", { role: "admin" }),
        countRows(supabase, "profiles", { role: "operator" }),
        ...operationalTables.map((table) => countRows(supabase, table)),
      ]);
      return {
        adminCount,
        operationalRowCount: counts.reduce((sum, count) => sum + count, 0),
        operatorCount,
      };
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

function validateCredentials(credentials, environment) {
  const values = {
    email: credentials?.email?.trim(),
    fullName: credentials?.fullName?.trim(),
    password: credentials?.password,
  };
  if (!values.email || !values.fullName || !values.password) {
    throw new Error(`Missing ${environment} administrator credentials.`);
  }
  if (
    values.password.length < 14 ||
    !/[a-z]/.test(values.password) ||
    !/[A-Z]/.test(values.password) ||
    !/[0-9]/.test(values.password) ||
    !/[^A-Za-z0-9]/.test(values.password)
  ) {
    throw new Error(`${environment} admin requires a strong password.`);
  }
  return values;
}

function assertUserSet(users, credentials, environment) {
  if (!Array.isArray(users) || users.length > 1) {
    throw new Error("Bootstrap requires exactly zero or one Auth user.");
  }
  if (
    users[0] &&
    users[0].email?.toLowerCase() !== credentials.email.toLowerCase()
  ) {
    throw new Error(`A different Auth user already exists in ${environment}.`);
  }
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

async function countRows(supabase, table, equality) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (equality) {
    const [column, value] = Object.entries(equality)[0];
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error || count === null) throw new Error(`Unable to count ${table}.`);
  return count;
}
