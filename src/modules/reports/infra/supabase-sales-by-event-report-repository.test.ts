import { describe, expect, it, vi } from "vitest";

import { SupabaseSalesByEventReportRepository } from "./supabase-sales-by-event-report-repository";

describe("SupabaseSalesByEventReportRepository", () => {
  it("aggregates completed sales and canceled sales by event", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Evento Julho",
      },
      error: null,
    }));
    const eventEq = vi.fn(() => ({ maybeSingle }));
    const eventSelect = vi.fn(() => ({ eq: eventEq }));

    const salesEq = vi.fn(async () => ({
      data: [
        {
          id: "sale-1",
          payments: [
            {
              amount_in_cents: 5000,
              change_in_cents: 2000,
              method: "cash",
            },
          ],
          sale_items: [
            {
              product_id: "product-1",
              product_name: "Chaveiro Polvo",
              quantity: 2,
              total_in_cents: 3000,
            },
          ],
          status: "completed",
          total_in_cents: 3000,
        },
        {
          id: "sale-2",
          payments: [
            {
              amount_in_cents: 1500,
              change_in_cents: 0,
              method: "pix",
            },
          ],
          sale_items: [
            {
              product_id: "product-1",
              product_name: "Chaveiro Polvo",
              quantity: 1,
              total_in_cents: 1500,
            },
          ],
          status: "completed",
          total_in_cents: 1500,
        },
        {
          id: "sale-3",
          payments: [
            {
              amount_in_cents: 1500,
              change_in_cents: 0,
              method: "cash",
            },
          ],
          sale_items: [
            {
              product_id: "product-1",
              product_name: "Chaveiro Polvo",
              quantity: 1,
              total_in_cents: 1500,
            },
          ],
          status: "canceled",
          total_in_cents: 1500,
        },
      ],
      error: null,
    }));
    const salesSelect = vi.fn(() => ({ eq: salesEq }));
    const supabaseClient = {
      from: vi.fn((table: "events" | "sales") => {
        if (table === "events") {
          return {
            select: eventSelect,
          };
        }

        return {
          select: salesSelect,
        };
      }),
    };
    const repository = new SupabaseSalesByEventReportRepository(
      supabaseClient as never,
    );

    const result = await repository.getByEventId(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toEqual({
      report: {
        canceledSalesCount: 1,
        canceledTotalInReais: 15,
        completedSalesCount: 2,
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "Evento Julho",
        grossTotalInReais: 45,
        items: [
          {
            grossTotalInReais: 45,
            productId: "product-1",
            productName: "Chaveiro Polvo",
            quantity: 3,
          },
        ],
        paymentSummary: [
          {
            method: "cash",
            netTotalInReais: 30,
            salesCount: 1,
          },
          {
            method: "pix",
            netTotalInReais: 15,
            salesCount: 1,
          },
          {
            method: "credit_card",
            netTotalInReais: 0,
            salesCount: 0,
          },
          {
            method: "debit_card",
            netTotalInReais: 0,
            salesCount: 0,
          },
        ],
      },
      success: true,
    });
    expect(salesEq).toHaveBeenCalledWith(
      "event_id",
      "11111111-1111-4111-8111-111111111111",
    );
  });
});
