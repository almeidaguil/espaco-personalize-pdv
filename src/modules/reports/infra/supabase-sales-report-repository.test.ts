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
        completedSalesCount: 2,
        completedTotalInCents: 4500,
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
            differenceAmountInCents: -100,
            id: cashSessionId,
            operatorName: "Ana Vendedora",
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
  completed_sales_count: 2,
  completed_total_in_cents: 4500,
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
      completed_total_in_cents: 4500,
      counted_amount_in_cents: 7400,
      difference_amount_in_cents: -100,
      expected_amount_in_cents: 7500,
      id: cashSessionId,
      opened_at: "2026-10-02T12:00:00.000Z",
      opening_amount_in_cents: 3000,
      operator_id: operatorId,
      operator_name: "Ana Vendedora",
      status: "closed",
    },
  ],
  start_date: "2026-10-02",
};
