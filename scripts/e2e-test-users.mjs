/** @typedef {"admin" | "operatorA" | "operatorB"} E2EUserName */

/**
 * @param {Record<string, string | undefined>} environment
 * @returns {{ name: E2EUserName, email: string, password: string, fullName: string, role: "admin" | "operator" }[]}
 */
export function resolveE2EUsers(environment) {
  const definitions = [
    { name: "admin", prefix: "E2E_USER", fullName: "E2E Admin", role: "admin" },
    {
      name: "operatorA",
      prefix: "E2E_OPERATOR_A",
      fullName: "E2E Operator A",
      role: "operator",
    },
    {
      name: "operatorB",
      prefix: "E2E_OPERATOR_B",
      fullName: "E2E Operator B",
      role: "operator",
    },
  ];
  const missingVariables = definitions.flatMap(({ prefix }) =>
    [`${prefix}_EMAIL`, `${prefix}_PASSWORD`].filter(
      (variableName) => !environment[variableName]?.trim(),
    ),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required E2E environment variables: ${missingVariables.join(", ")}`,
    );
  }

  const users = definitions.map(({ name, prefix, fullName, role }) => ({
    name,
    email: environment[`${prefix}_EMAIL`].trim(),
    password: environment[`${prefix}_PASSWORD`],
    fullName,
    role,
  }));

  if (
    new Set(users.map(({ email }) => email.toLowerCase())).size !== users.length
  ) {
    throw new Error(
      "E2E_USER_EMAIL, E2E_OPERATOR_A_EMAIL, E2E_OPERATOR_B_EMAIL must identify distinct users.",
    );
  }

  return users;
}

/** @param {string | undefined} value */
export function assertLocalSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid NEXT_PUBLIC_SUPABASE_URL for the local E2E gate.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must target the local Supabase instance for E2E.",
    );
  }
}
