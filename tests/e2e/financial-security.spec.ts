import { expect, test } from "@playwright/test";

import {
  createAuthenticatedSupabaseClient,
  hasAuthenticatedE2EConfig,
} from "./support/auth";

test.skip(
  !hasAuthenticatedE2EConfig(),
  "E2E auth and Supabase public env vars are required for financial security tests.",
);

test("authenticated users cannot write financial records directly", async () => {
  const supabase = await createAuthenticatedSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  expect(user).not.toBeNull();

  const saleId = crypto.randomUUID();
  const now = new Date().toISOString();

  const attempts = [
    {
      name: "insert sale",
      result: await supabase.from("sales").insert({
        cash_session_id: crypto.randomUUID(),
        completed_at: now,
        event_id: crypto.randomUUID(),
        id: saleId,
        operator_id: user?.id ?? crypto.randomUUID(),
        status: "completed",
        total_in_cents: 1500,
      }),
    },
    {
      name: "update sale",
      result: await supabase
        .from("sales")
        .update({
          status: "canceled",
        })
        .eq("id", saleId),
    },
    {
      name: "insert sale item",
      result: await supabase.from("sale_items").insert({
        product_id: crypto.randomUUID(),
        product_name: "Produto bloqueado",
        quantity: 1,
        sale_id: saleId,
        total_in_cents: 1500,
        unit_price_in_cents: 1500,
      }),
    },
    {
      name: "insert payment",
      result: await supabase.from("payments").insert({
        amount_in_cents: 1500,
        change_in_cents: 0,
        method: "cash",
        sale_id: saleId,
      }),
    },
  ];

  for (const attempt of attempts) {
    expect(attempt.result.error, attempt.name).not.toBeNull();
    expect(
      `${attempt.result.error?.code ?? ""} ${attempt.result.error?.message ?? ""}`,
      attempt.name,
    ).toMatch(/permission denied|42501|row-level security|violates/i);
  }
});
