import type { SalesReport } from "../application/sales-report-repository";

export const operatorId = "11111111-1111-4111-8111-111111111111";
export const cashSessionId = "22222222-2222-4222-8222-222222222222";
export const productId = "33333333-3333-4333-8333-333333333333";

export function createSalesReportFixture(
  overrides: Partial<SalesReport> = {},
): SalesReport {
  return {
    canceledSalesCount: 1,
    canceledTotalInCents: 1500,
    cashDifferenceTotalInCents: -100,
    cashSessionOptions: [
      {
        businessDate: "2026-10-02",
        id: cashSessionId,
        openedAt: "2026-10-02T12:00:00.000Z",
        operatorId,
        operatorName: "Ana Vendedora",
        status: "closed",
      },
    ],
    cashShortageTotalInCents: 200,
    cashSurplusTotalInCents: 100,
    completedSalesCount: 2,
    completedTotalInCents: 4500,
    endDate: "2026-10-02",
    items: [
      {
        grossTotalInCents: 4500,
        productId,
        productName: "Chaveiro Polvo",
        quantity: 3,
      },
    ],
    itemsPage: 1,
    itemsTotalCount: 1,
    netRevenueInCents: 4500,
    operatorOptions: [{ id: operatorId, name: "Ana Vendedora" }],
    pageSize: 8,
    paymentSummary: [
      { method: "cash", netTotalInCents: 3000, salesCount: 1 },
      { method: "pix", netTotalInCents: 1500, salesCount: 1 },
      { method: "credit_card", netTotalInCents: 0, salesCount: 0 },
      { method: "debit_card", netTotalInCents: 0, salesCount: 0 },
    ],
    postCloseAdjustmentPaymentSummary: [
      { method: "cash", netTotalInCents: 0, salesCount: 0 },
      { method: "pix", netTotalInCents: 0, salesCount: 0 },
      { method: "credit_card", netTotalInCents: 0, salesCount: 0 },
      { method: "debit_card", netTotalInCents: 0, salesCount: 0 },
    ],
    postCloseAdjustmentsCount: 0,
    postCloseAdjustmentsTotalInCents: 0,
    selectedCashSessionId: null,
    selectedOperatorId: null,
    sessions: [
      {
        businessDate: "2026-10-02",
        canceledSalesCount: 1,
        canceledTotalInCents: 1500,
        closedAt: "2026-10-02T20:00:00.000Z",
        completedSalesCount: 2,
        completedTotalInCents: 4500,
        countedAmountInCents: 7400,
        differenceAmountInCents: -100,
        expectedAmountInCents: 7500,
        id: cashSessionId,
        openedAt: "2026-10-02T12:00:00.000Z",
        openingAmountInCents: 3000,
        operatorId,
        operatorName: "Ana Vendedora",
        status: "closed",
      },
    ],
    sessionsPage: 1,
    sessionsTotalCount: 1,
    startDate: "2026-10-02",
    ...overrides,
  };
}
