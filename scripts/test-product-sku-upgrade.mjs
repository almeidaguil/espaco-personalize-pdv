import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const ids = {
  collisionA: "13100000-0000-4000-8000-000000000002",
  collisionB: "13100000-0000-4000-8000-000000000003",
  normalization: "13100000-0000-4000-8000-000000000001",
};
const mode = process.argv[2];

assert.ok(
  ["seed-normalization", "verify-normalization", "seed-collision"].includes(
    mode,
  ),
  "Expected seed-normalization, verify-normalization or seed-collision mode",
);

const environment = resolveEnvironment();
const apiUrl = new URL(environment.url);

assert.ok(
  ["127.0.0.1", "localhost", "::1", "[::1]"].includes(apiUrl.hostname),
  "Refusing to run the product SKU fixture against a remote Supabase",
);

const client = createClient(apiUrl.toString(), environment.key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

if (mode === "seed-normalization") {
  const { error } = await client.from("products").insert({
    id: ids.normalization,
    is_active: true,
    name: "Product SKU normalization fixture",
    price_in_cents: 1_000,
    sku: " rm-camisa-01 ",
  });

  assert.equal(error, null, "could not seed the mixed-case product SKU");
  console.log("Product SKU normalization fixture seeded locally.");
} else if (mode === "verify-normalization") {
  const { data, error } = await client
    .from("products")
    .select("id,sku")
    .eq("id", ids.normalization)
    .single();

  assert.equal(error, null, "could not read the normalized product SKU");
  assert.deepEqual(data, {
    id: ids.normalization,
    sku: "RM-CAMISA-01",
  });
  console.log("Product SKU normalization upgrade verified locally.");
} else {
  const { error } = await client.from("products").insert([
    {
      id: ids.collisionA,
      is_active: true,
      name: "Product SKU collision fixture A",
      price_in_cents: 1_000,
      sku: "sku-collision",
    },
    {
      id: ids.collisionB,
      is_active: true,
      name: "Product SKU collision fixture B",
      price_in_cents: 1_000,
      sku: "SKU-COLLISION",
    },
  ]);

  assert.equal(error, null, "could not seed colliding product SKUs");
  console.log("Product SKU collision fixture seeded locally.");
}

function resolveEnvironment() {
  const url = process.env.DATABASE_TEST_SUPABASE_URL;
  const key = process.env.DATABASE_TEST_SUPABASE_SECRET_KEY;

  if (url || key) {
    assert.ok(url && key, "Both product SKU fixture variables are required");
    return { key, url };
  }

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "status", "-o", "env"],
    {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
      shell: process.platform === "win32",
    },
  );

  assert.equal(result.status, 0, "Local Supabase stack is unavailable");

  const values = Object.fromEntries(
    result.stdout
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const separator = line.indexOf("=");

        return [
          line.slice(0, separator),
          line.slice(separator + 1).replace(/^"|"$/g, ""),
        ];
      }),
  );

  assert.ok(
    values.API_URL && values.SECRET_KEY,
    "Local Supabase values are missing",
  );

  return { key: values.SECRET_KEY, url: values.API_URL };
}
