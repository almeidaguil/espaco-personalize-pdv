import { expect, test } from "@playwright/test";

import {
  createAnonymousSupabaseClient,
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
        id: saleId,
        operator_id: user?.id ?? crypto.randomUUID(),
        status: "completed",
        discount_in_cents: 0,
        subtotal_in_cents: 1500,
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
    {
      name: "insert cash reconciliation",
      result: await supabase.from("cash_session_reconciliations").insert({
        cash_session_id: crypto.randomUUID(),
        counted_amount_in_cents: 0,
        difference_amount_in_cents: 0,
        expected_amount_in_cents: 0,
        method: "cash",
      }),
    },
  ];

  for (const attempt of attempts) {
    expect(attempt.result.error, attempt.name).not.toBeNull();
    expect(attempt.result.error?.code, attempt.name).toBe("42501");
    expect(
      `${attempt.result.error?.code ?? ""} ${attempt.result.error?.message ?? ""}`,
      attempt.name,
    ).toMatch(/permission denied|row-level security/i);
  }
});

test("authenticated users cannot execute the legacy cash close RPC", async () => {
  const supabase = await createAuthenticatedSupabaseClient();
  const result = await supabase.rpc("close_cash_session", {
    p_admin_password: null,
    p_cash_session_id: crypto.randomUUID(),
    p_closed_at: new Date().toISOString(),
    p_counted_amount_in_cents: 0,
  });

  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
  expect(`${result.error?.code ?? ""} ${result.error?.message ?? ""}`).toMatch(
    /42501|permission denied/i,
  );
});

test("anonymous users cannot execute split-payment sale finalization", async () => {
  const supabase = createAnonymousSupabaseClient();
  const result = await supabase.rpc("finalize_sale_v5", {
    p_cash_session_id: crypto.randomUUID(),
    p_discount_in_cents: 100,
    p_items: [{ product_id: crypto.randomUUID(), quantity: 1 }],
    p_payments: [
      {
        amount_in_cents: 1400,
        method: "pix",
      },
    ],
    p_sale_id: crypto.randomUUID(),
  });

  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
  expect(`${result.error?.code ?? ""} ${result.error?.message ?? ""}`).toMatch(
    /42501|permission denied/i,
  );
});
