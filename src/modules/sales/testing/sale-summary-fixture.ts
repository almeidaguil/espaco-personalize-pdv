import type { SaleSummary } from "../application/sale-summary-repository";

export function saleSummaryFixture(
  overrides: Partial<SaleSummary> = {},
): SaleSummary {
  return {
    id: "sale-1",
    cashSessionId: "cash-session-1",
    operatorId: "operator-1",
    operatorName: "Ana",
    payments: [
      {
        amountInCents: 3000,
        changeInCents: 0,
        method: "cash",
      },
    ],
    businessDate: "2026-07-10",
    cashSessionOpenedAt: new Date("2026-07-10T11:00:00Z"),
    completedAt: new Date("2026-07-10T12:00:00Z"),
    status: "completed",
    subtotalInCents: 3000,
    discountInCents: 0,
    totalInCents: 3000,
    ...overrides,
  };
}
