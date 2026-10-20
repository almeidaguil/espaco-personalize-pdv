import { describe, expect, it, vi } from "vitest";

import {
  cashSessionId,
  operatorId,
  productId,
} from "../testing/sales-report-fixture";
import { SupabaseSalesReportRepository } from "./supabase-sales-report-repository";

describe("SupabaseSalesReportRepository", () => {
  it("maps the database aggregate without converting monetary cents", async () => {
    const rpc = vi.fn(async () => ({ data: databaseReport, error: null }));
    const repository = new SupabaseSalesReportRepository({ rpc });

    const result = await repository.get({
      endDate: "2026-10-02",
      startDate: "2026-10-02",
    });

    expect(rpc).toHaveBeenCalledWith("get_store_sales_report_v2", {
      p_cash_session_id: null,
      p_end_date: "2026-10-02",
      p_export_mode: false,
      p_items_limit: 8,
      p_items_offset: 0,
      p_operator_id: null,
      p_sessions_limit: 8,
      p_sessions_offset: 0,
      p_start_date: "2026-10-02",
    });
    expect(result).toMatchObject({
      report: {
        canceledSalesCount: 1,
        canceledTotalInCents: 1500,
        cashDifferenceTotalInCents: -100,
        cashShortageTotalInCents: 200,
        cashSurplusTotalInCents: 100,
        creditInstallmentSummary: [
          { installmentCount: 1, netTotalInCents: 0, salesCount: 0 },
          { installmentCount: 2, netTotalInCents: 6000, salesCount: 1 },
          { installmentCount: 3, netTotalInCents: 3000, salesCount: 1 },
        ],
        completedDiscountInCents: 1000,
        completedSalesCount: 2,
        completedSubtotalInCents: 10000,
        completedTotalInCents: 9000,
        reconciliationDifferenceTotalInCents: -150,
        reconciliationShortageTotalInCents: 250,
        reconciliationSurplusTotalInCents: 100,
        items: [
          {
            grossTotalInCents: 4500,
            productId,
            productName: "Chaveiro Polvo",
            quantity: 3,
          },
        ],
        sessions: [
          expect.objectContaining({
            completedDiscountInCents: 1000,
            completedSubtotalInCents: 10000,
            completedTotalInCents: 9000,
            differenceAmountInCents: -100,
            id: cashSessionId,
            operatorName: "Ana Vendedora",
            reconciliations: [
              {
                countedAmountInCents: 7400,
                differenceAmountInCents: -100,
                expectedAmountInCents: 7500,
                method: "cash",
              },
              {
                countedAmountInCents: 1500,
                differenceAmountInCents: 0,
                expectedAmountInCents: 1500,
                method: "pix",
              },
              {
                countedAmountInCents: 8900,
                differenceAmountInCents: -100,
                expectedAmountInCents: 9000,
                method: "credit_card",
              },
              {
                countedAmountInCents: 50,
                differenceAmountInCents: 50,
                expectedAmountInCents: 0,
                method: "debit_card",
              },
            ],
          }),
        ],
      },
      success: true,
    });
  });

  it("maps a legacy session fallback from cash scalar fields only", async () => {
    const legacyReport = structuredClone(databaseReport);
    legacyReport.sessions[0].reconciliations = [];
    const repository = new SupabaseSalesReportRepository({
      rpc: vi.fn(async () => ({ data: legacyReport, error: null })),
    });

    const result = await repository.get({
      endDate: "2026-10-02",
      startDate: "2026-10-02",
    });

    expect(result).toMatchObject({
      report: {
        sessions: [
          expect.objectContaining({
            reconciliations: [
              {
                countedAmountInCents: 7400,
                differenceAmountInCents: -100,
                expectedAmountInCents: 7500,
                method: "cash",
              },
            ],
          }),
        ],
      },
      success: true,
    });
  });

  it.each([
    [
      "42501",
      "Operators can only generate their own sales report.",
      "forbidden",
    ],
    [
      "P0001",
      "Authentication is required to generate a sales report.",
      "unauthorized",
    ],
    [
      "P0001",
      "An active user is required to generate a sales report.",
      "unauthorized",
    ],
    ["P0001", "Unexpected database error.", "unknown"],
  ])(
    "maps database errors to application errors",
    async (code, message, expectedError) => {
      const repository = new SupabaseSalesReportRepository({
        rpc: vi.fn(async () => ({ data: null, error: { code, message } })),
      });

      await expect(
        repository.get({ endDate: "2026-10-02", startDate: "2026-10-02" }),
      ).resolves.toEqual({ error: expectedError, success: false });
    },
  );

  it("rejects an invalid RPC payload at the infrastructure boundary", async () => {
    const repository = new SupabaseSalesReportRepository({
      rpc: vi.fn(async () => ({
        data: { completed_sales_count: "broken" },
        error: null,
      })),
    });

    await expect(
      repository.get({ endDate: "2026-10-02", startDate: "2026-10-02" }),
    ).resolves.toEqual({ error: "unknown", success: false });
  });
});

const databaseReport = {
  canceled_sales_count: 1,
  canceled_total_in_cents: 1500,
  cash_difference_total_in_cents: -100,
  cash_session_options: [
    {
      business_date: "2026-10-02",
      id: cashSessionId,
      opened_at: "2026-10-02T12:00:00.000Z",
      operator_id: operatorId,
      operator_name: "Ana Vendedora",
      status: "closed",
    },
  ],
  cash_shortage_total_in_cents: 200,
  cash_surplus_total_in_cents: 100,
  credit_installment_summary: [
    { installment_count: 1, net_total_in_cents: 0, sales_count: 0 },
    { installment_count: 2, net_total_in_cents: 6000, sales_count: 1 },
    { installment_count: 3, net_total_in_cents: 3000, sales_count: 1 },
  ],
  completed_discount_in_cents: 1000,
  completed_sales_count: 2,
  completed_subtotal_in_cents: 10000,
  completed_total_in_cents: 9000,
  end_date: "2026-10-02",
  items_limit: 8,
  items_offset: 0,
  items_total_count: 1,
  items: [
    {
      gross_total_in_cents: 4500,
      product_id: productId,
      product_name: "Chaveiro Polvo",
      quantity: 3,
    },
  ],
  net_revenue_in_cents: 4500,
  operator_options: [{ id: operatorId, name: "Ana Vendedora" }],
  payment_summary: [
    { method: "cash", net_total_in_cents: 3000, sales_count: 1 },
    { method: "pix", net_total_in_cents: 1500, sales_count: 1 },
    { method: "credit_card", net_total_in_cents: 0, sales_count: 0 },
    { method: "debit_card", net_total_in_cents: 0, sales_count: 0 },
  ],
  post_close_adjustment_payment_summary: [
    { method: "cash", net_total_in_cents: 0, sales_count: 0 },
    { method: "pix", net_total_in_cents: 0, sales_count: 0 },
    { method: "credit_card", net_total_in_cents: 0, sales_count: 0 },
    { method: "debit_card", net_total_in_cents: 0, sales_count: 0 },
  ],
  post_close_adjustments_count: 0,
  post_close_adjustments_total_in_cents: 0,
  reconciliation_difference_total_in_cents: -150,
  reconciliation_shortage_total_in_cents: 250,
  reconciliation_surplus_total_in_cents: 100,
  selected_cash_session_id: null,
  selected_operator_id: null,
  sessions_limit: 8,
  sessions_offset: 0,
  sessions_total_count: 1,
  sessions: [
    {
      business_date: "2026-10-02",
      canceled_sales_count: 1,
      canceled_total_in_cents: 1500,
      closed_at: "2026-10-02T20:00:00.000Z",
      completed_sales_count: 2,
      completed_discount_in_cents: 1000,
      completed_subtotal_in_cents: 10000,
      completed_total_in_cents: 9000,
      counted_amount_in_cents: 7400,
      difference_amount_in_cents: -100,
      expected_amount_in_cents: 7500,
      id: cashSessionId,
      opened_at: "2026-10-02T12:00:00.000Z",
      opening_amount_in_cents: 3000,
      operator_id: operatorId,
      operator_name: "Ana Vendedora",
      reconciliations: [
        {
          counted_amount_in_cents: 7400,
          difference_amount_in_cents: -100,
          expected_amount_in_cents: 7500,
          method: "cash",
        },
        {
          counted_amount_in_cents: 1500,
          difference_amount_in_cents: 0,
          expected_amount_in_cents: 1500,
          method: "pix",
        },
        {
          counted_amount_in_cents: 8900,
          difference_amount_in_cents: -100,
          expected_amount_in_cents: 9000,
          method: "credit_card",
        },
        {
          counted_amount_in_cents: 50,
          difference_amount_in_cents: 50,
          expected_amount_in_cents: 0,
          method: "debit_card",
        },
      ],
      status: "closed",
    },
  ],
  start_date: "2026-10-02",
};
