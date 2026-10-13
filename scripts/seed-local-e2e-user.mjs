import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { assertLocalSupabaseUrl, resolveE2EUsers } from "./e2e-test-users.mjs";

const environment = {
  ...readEnvFile(".env.local"),
  ...readEnvFile(".env.e2e.local"),
  ...process.env,
};

try {
  const users = resolveE2EUsers(environment);
  const requiredVariables = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"];
  const missingVariables = requiredVariables.filter(
    (variableName) => !environment[variableName]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required E2E environment variables: ${missingVariables.join(", ")}`,
    );
  }

  assertLocalSupabaseUrl(environment.NEXT_PUBLIC_SUPABASE_URL);

  const supabase = createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const existingUsers = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1_000,
    });
    if (error) throw new Error("Failed to list local E2E users.");
    existingUsers.push(...data.users);
    if (data.users.length < 1_000) break;
  }

  for (const { name, email, password, fullName, role } of users) {
    const existingUser = existingUsers.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    let userId;

    if (existingUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password,
          email_confirm: true,
          user_metadata: {
            ...existingUser.user_metadata,
            full_name: fullName,
            role,
          },
        },
      );

      if (error) {
        throw new Error(`Failed to update local E2E ${name}.`);
      }

      userId = data.user.id;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
        user_metadata: {
          full_name: fullName,
          role,
        },
      });

      if (error) {
        throw new Error(`Failed to create local E2E ${name}.`);
      }

      userId = data.user.id;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, email, full_name: fullName, role });

    if (profileError) {
      throw new Error(`Failed to update local E2E ${name} profile.`);
    }

    console.log(
      `Local E2E ${name} is ready (${existingUser ? "updated" : "created"}).`,
    );
  }
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Failed to seed local E2E users.",
  );
  process.exit(1);
}

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
