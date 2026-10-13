import { expect, test } from "@playwright/test";

import {
  createAuthenticatedPage,
  createAuthenticatedSupabaseClient,
} from "./support/auth";
import {
  closeCashSessionThroughUi,
  closeOwnOpenCashSession,
  getOwnOpenCashSession,
  openCashSessionThroughUi,
} from "./support/cash";

test.beforeEach(async () => {
  await closeOwnOpenCashSession("operatorA");
  await closeOwnOpenCashSession("operatorB");
});

test.afterEach(async () => {
  await Promise.all([
    closeOwnOpenCashSession("operatorA"),
    closeOwnOpenCashSession("operatorB"),
  ]);
});

test("two browser contexts of one operator can only open one cash session", async ({
  browser,
}) => {
  const first = await createAuthenticatedPage(browser, "operatorA");
  const second = await createAuthenticatedPage(browser, "operatorA");
  try {
    expect(first.context).not.toBe(second.context);
    await Promise.all([
      first.page.goto("/cash/open"),
      second.page.goto("/cash/open"),
    ]);
    await Promise.all([
      first.page.getByLabel("Valor inicial").fill("10,00"),
      second.page.getByLabel("Valor inicial").fill("10,00"),
    ]);
    await Promise.all([
      first.page.getByRole("button", { name: "Abrir caixa" }).click(),
      second.page.getByRole("button", { name: "Abrir caixa" }).click(),
    ]);
    await expect
      .poll(async () => {
        const results = await Promise.all(
          [first.page, second.page].map(async (page) => ({
            success: await page
              .getByText("Caixa aberto com sucesso.", { exact: true })
              .count(),
            duplicate: await page
              .getByText("Ja existe um caixa aberto para este operador.", {
                exact: true,
              })
              .count(),
          })),
        );
        return results.reduce(
          (total, result) => ({
            success: total.success + result.success,
            duplicate: total.duplicate + result.duplicate,
          }),
          { success: 0, duplicate: 0 },
        );
      })
      .toEqual({ success: 1, duplicate: 1 });
    const session = await getOwnOpenCashSession("operatorA");
    expect(session).not.toBeNull();
    expect(session?.opening_amount_in_cents).toBe(1000);
  } finally {
    await Promise.all([first.context.close(), second.context.close()]);
  }
});

test("operators keep independent cash sessions with audited administrative closure", async ({
  browser,
}) => {
  const operatorA = await createAuthenticatedPage(browser, "operatorA");
  const operatorB = await createAuthenticatedPage(browser, "operatorB");
  const admin = await createAuthenticatedPage(browser, "admin");
  try {
    const [sessionA, sessionB] = await Promise.all([
      openCashSessionThroughUi(operatorA.page, "operatorA", "25,00"),
      openCashSessionThroughUi(operatorB.page, "operatorB", "50,00"),
    ]);
    expect(sessionA.id).not.toBe(sessionB.id);
    expect(sessionA.operator_id).not.toBe(sessionB.operator_id);
    await operatorA.page.goto("/cash/close");
    await expect(
      operatorA.page.locator(
        `input[name="cashSessionId"][value="${sessionA.id}"]`,
      ),
    ).toHaveCount(1);
    await expect(
      operatorA.page.locator(
        `input[name="cashSessionId"][value="${sessionB.id}"]`,
      ),
    ).toHaveCount(0);
    const clientA = await createAuthenticatedSupabaseClient("operatorA");
    const hiddenSession = await clientA
      .from("cash_sessions")
      .select("id")
      .eq("id", sessionB.id);
    expect(hiddenSession.error).toBeNull();
    expect(hiddenSession.data).toEqual([]);
    const forbiddenClose = await clientA.rpc("close_cash_session", {
      p_cash_session_id: sessionB.id,
      p_counted_amount_in_cents: 5000,
      p_closed_at: new Date().toISOString(),
    });
    expect(forbiddenClose.error?.message).toBe(
      "User is not allowed to close this cash session.",
    );
    expect(forbiddenClose.data).toBeNull();
    await closeCashSessionThroughUi(operatorA.page, sessionA.id, "25,00");
    expect(await getOwnOpenCashSession("operatorA")).toBeNull();
    expect((await getOwnOpenCashSession("operatorB"))?.id).toBe(sessionB.id);
    await operatorB.page.goto("/pdv");
    await expect(
      operatorB.page.getByText(`Sessao #${sessionB.id.slice(0, 8)}`),
    ).toBeVisible();
    const reopened = await openCashSessionThroughUi(
      operatorA.page,
      "operatorA",
      "15,00",
    );
    expect(reopened.id).not.toBe(sessionA.id);
    expect(new Date(reopened.opened_at).toDateString()).toBe(
      new Date(sessionA.opened_at).toDateString(),
    );
    await closeCashSessionThroughUi(admin.page, reopened.id, "15,00");
    const adminClient = await createAuthenticatedSupabaseClient("admin");
    const { data: identity, error: identityError } =
      await adminClient.auth.getUser();
    expect(identityError).toBeNull();
    const { data: closed, error } = await adminClient
      .from("cash_sessions")
      .select(
        "status,operator_id,closed_by,closed_at,counted_amount_in_cents,expected_amount_in_cents,difference_amount_in_cents",
      )
      .eq("id", reopened.id)
      .single();
    expect(error).toBeNull();
    expect(closed).toMatchObject({
      status: "closed",
      operator_id: sessionA.operator_id,
      closed_by: identity.user?.id,
      counted_amount_in_cents: 1500,
      expected_amount_in_cents: 1500,
      difference_amount_in_cents: 0,
    });
    expect(closed?.closed_at).not.toBeNull();
    expect((await getOwnOpenCashSession("operatorB"))?.id).toBe(sessionB.id);
    await closeCashSessionThroughUi(operatorB.page, sessionB.id, "50,00");
    expect(await getOwnOpenCashSession("operatorB")).toBeNull();
  } finally {
    await Promise.all([
      operatorA.context.close(),
      operatorB.context.close(),
      admin.context.close(),
    ]);
  }
});
