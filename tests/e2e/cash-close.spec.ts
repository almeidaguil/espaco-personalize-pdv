import { expect, test } from "@playwright/test";
import { authenticatePage } from "./support/auth";
import {
  closeCashSessionThroughUi,
  closeOwnOpenCashSession,
  openCashSessionThroughUi,
} from "./support/cash";

test.beforeEach(async ({ page }) => {
  await closeOwnOpenCashSession();
  await authenticatePage(page);
});
test.afterEach(async () => {
  await closeOwnOpenCashSession();
});

test("admin closes and reopens a cash session on the same day", async ({
  page,
}) => {
  const first = await openCashSessionThroughUi(page, "admin", "150,50");
  await closeCashSessionThroughUi(page, first.id, "150,50");
  const second = await openCashSessionThroughUi(page, "admin", "25,00");
  expect(second.id).not.toBe(first.id);
  expect(new Date(second.opened_at).toDateString()).toBe(
    new Date(first.opened_at).toDateString(),
  );
  await closeCashSessionThroughUi(page, second.id, "25,00");
});
