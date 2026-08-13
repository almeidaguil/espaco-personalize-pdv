import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const environment = {
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.e2e.local"),
  ...process.env,
};

const requiredVariables = [
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
];
const missingVariables = requiredVariables.filter(
  (variableName) => !environment[variableName],
);

if (missingVariables.length > 0) {
  console.error(
    `Missing variables required to seed the local E2E user: ${missingVariables.join(", ")}`,
  );
  process.exit(1);
}

const supabaseUrl = new URL(environment.NEXT_PUBLIC_SUPABASE_URL);

if (!["127.0.0.1", "localhost"].includes(supabaseUrl.hostname)) {
  console.error(
    "Refusing to seed an E2E user outside the local Supabase instance.",
  );
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl.toString(),
  environment.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
const email = environment.E2E_USER_EMAIL;
const password = environment.E2E_USER_PASSWORD;
const fullName = "E2E Admin";
const { data: usersData, error: listUsersError } =
  await supabase.auth.admin.listUsers({ page: 1, perPage: 1_000 });

if (listUsersError) {
  throw listUsersError;
}

const existingUser = usersData.users.find((user) => user.email === email);
let userId;

if (existingUser) {
  const { data, error } = await supabase.auth.admin.updateUserById(
    existingUser.id,
    {
      password,
      user_metadata: {
        ...existingUser.user_metadata,
        full_name: fullName,
        role: "admin",
      },
    },
  );

  if (error) {
    throw error;
  }

  userId = data.user.id;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: fullName,
      role: "admin",
    },
  });

  if (error) {
    throw error;
  }

  userId = data.user.id;
}

const { error: profileError } = await supabase
  .from("profiles")
  .update({ full_name: fullName, role: "admin" })
  .eq("id", userId);

if (profileError) {
  throw profileError;
}

console.log(
  `Local E2E admin is ready (${existingUser ? "updated" : "created"}).`,
);

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();

        return [key, stripWrappingQuotes(rawValue)];
      }),
  );
}

function stripWrappingQuotes(value) {
  const firstCharacter = value.at(0);
  const lastCharacter = value.at(-1);

  if (
    value.length >= 2 &&
    ((firstCharacter === '"' && lastCharacter === '"') ||
      (firstCharacter === "'" && lastCharacter === "'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
