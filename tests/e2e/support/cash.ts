import { expect, type Page } from "@playwright/test";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PaymentMethod } from "@/shared/types/payment-method";

import {
  createAuthenticatedSupabaseClient,
  getE2EUserCredentials,
  type E2EUserName,
} from "./auth";

type OpenCashSession = {
  id: string;
  operator_id: string;
  opening_amount_in_cents: number;
  opened_at: string;
};

export async function getOwnOpenCashSession(userName: E2EUserName = "admin") {
  const supabase = await createAuthenticatedSupabaseClient(userName);
  const {
    data: { user },
    error: identityError,
  } = await supabase.auth.getUser();
  if (identityError || !user)
    throw new Error(
      `Authenticated E2E ${userName} is required for cash setup.`,
    );
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("id,operator_id,opening_amount_in_cents,opened_at")
    .eq("operator_id", user.id)
    .eq("status", "open")
    .maybeSingle<OpenCashSession>();
  if (error)
    throw new Error(
      `Failed to read own open cash session for E2E ${userName}.`,
    );
  return data;
}

export async function closeOwnOpenCashSession(userName: E2EUserName = "admin") {
  const session = await getOwnOpenCashSession(userName);
  if (!session) return;
  const supabase = await createAuthenticatedSupabaseClient(userName);
  // A deliberately generous count lets cleanup close any fixture state.
  // The real V2 transaction still validates and records all four methods.
  const { error } = await closeCashSessionV2(
    supabase,
    session.id,
    {
      cash: 99_999_900,
      credit_card: 99_999_900,
      debit_card: 99_999_900,
      pix: 99_999_900,
    },
    getE2EUserCredentials("admin").password,
  );
  if (error)
    throw new Error(
      `Failed to close own open cash session for E2E ${userName}.`,
    );
  expect(await getOwnOpenCashSession(userName)).toBeNull();
}

export async function openCashSessionThroughUi(
  page: Page,
  userName: E2EUserName = "admin",
  openingAmount = "100,00",
) {
  expect(await getOwnOpenCashSession(userName)).toBeNull();
  await page.goto("/cash/open");
  await page.getByLabel("Valor inicial").fill(openingAmount);
  await page.getByRole("button", { name: "Abrir caixa" }).click();
  await expect(
    page.getByText("Caixa aberto com sucesso.", { exact: true }),
  ).toBeVisible();
  const session = await getOwnOpenCashSession(userName);
  if (!session)
    throw new Error(`Expected own open cash session for E2E ${userName}.`);
  await page.goto("/pdv");
  await expect(
    page.getByText(`Sessao #${session.id.slice(0, 8)}`),
  ).toBeVisible();
  return session;
}

export function cashSessionCloseForm(page: Page, sessionId: string) {
  return page.locator("form").filter({
    has: page.locator(`input[name="cashSessionId"][value="${sessionId}"]`),
  });
}

export async function closeCashSessionThroughUi(
  page: Page,
  sessionId: string,
  countedAmounts: Record<PaymentMethod, string>,
  adminPassword?: string,
) {
  await page.goto("/cash/close");
  const form = cashSessionCloseForm(page, sessionId);
  await expect(form).toHaveCount(1);
  await form.getByLabel("Valor conferido — Dinheiro").fill(countedAmounts.cash);
  await form.getByLabel("Valor conferido — Pix").fill(countedAmounts.pix);
  await form
    .getByLabel("Valor conferido — Cartão de crédito")
    .fill(countedAmounts.credit_card);
  await form
    .getByLabel("Valor conferido — Cartão de débito")
    .fill(countedAmounts.debit_card);
  if (adminPassword) {
    await form.getByLabel("Senha administrativa").fill(adminPassword);
  }
  await form.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(
    form.getByText("Caixa fechado com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.goto("/cash/close");
  await expect(cashSessionCloseForm(page, sessionId)).toHaveCount(0);
}

export function closeCashSessionV2(
  client: SupabaseClient,
  cashSessionId: string,
  countedAmounts: Record<PaymentMethod, number>,
  adminPassword?: string,
) {
  return client.rpc("close_cash_session_v2", {
    p_admin_password: adminPassword ?? null,
    p_cash_session_id: cashSessionId,
    p_reconciliations: Object.entries(countedAmounts).map(
      ([method, countedAmountInCents]) => ({
        counted_amount_in_cents: countedAmountInCents,
        method,
      }),
    ),
  });
}
