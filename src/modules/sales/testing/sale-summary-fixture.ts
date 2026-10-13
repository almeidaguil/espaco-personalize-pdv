import type { SaleSummary } from "../application/sale-summary-repository";

export function saleSummaryFixture(
  overrides: Partial<SaleSummary> = {},
): SaleSummary {
  return {
    id: "sale-1",
    cashSessionId: "cash-session-1",
    operatorId: "operator-1",
    operatorName: "Ana",
    businessDate: "2026-07-10",
    cashSessionOpenedAt: new Date("2026-07-10T11:00:00Z"),
    completedAt: new Date("2026-07-10T12:00:00Z"),
    status: "completed",
    totalInReais: 30,
    ...overrides,
  };
}
