import { expect, type Page } from "@playwright/test";

import { createAuthenticatedSupabaseClient, type E2EUserName } from "./auth";

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
  // The generous counted amount avoids shortage authorization during cleanup.
  // Reconciliation and audit still run through the real server transaction.
  const { error } = await supabase.rpc("close_cash_session", {
    p_cash_session_id: session.id,
    p_counted_amount_in_cents: 99999900,
    p_closed_at: new Date().toISOString(),
  });
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
  countedAmount = "100,00",
) {
  await page.goto("/cash/close");
  const form = cashSessionCloseForm(page, sessionId);
  await expect(form).toHaveCount(1);
  await form.getByLabel("Valor contado no caixa").fill(countedAmount);
  await form.getByRole("button", { name: "Fechar caixa" }).click();
  await expect(
    form.getByText("Caixa fechado com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.goto("/cash/close");
  await expect(cashSessionCloseForm(page, sessionId)).toHaveCount(0);
}
