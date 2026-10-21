import { describe, expect, it } from "vitest";
import { SupabaseSaleDetailRepository } from "./supabase-sale-detail-repository";
import { createSalesReadClient, saleRow } from "../testing/sales-read-client";

describe("SupabaseSaleDetailRepository", () => {
  it("reads a complete sale linked to its operator cash session", async () => {
    const client = createSalesReadClient();
    expect(
      await new SupabaseSaleDetailRepository(client).findById("sale-1"),
    ).toMatchObject({
      success: true,
      sale: {
        id: "sale-1",
        operatorId: "operator-1",
        operatorName: "Ana",
        cashSessionId: "cash-session-1",
        businessDate: "2026-07-10",
        subtotalInCents: 3000,
        discountInCents: 0,
        totalInCents: 3000,
        items: [{ productName: "Camiseta", quantity: 2, totalInCents: 3000 }],
        payments: [
          {
            method: "cash",
            amountInCents: 5000,
            changeInCents: 2000,
          },
        ],
      },
    });
    expect(client.calls).toContainEqual(["eq", "id", "sale-1"]);
  });
  it("preserves every split payment and credit installments", async () => {
    const client = createSalesReadClient({
      sales: [
        saleRow({
          payments: [
            {
              amount_in_cents: 1000,
              change_in_cents: 0,
              installment_count: null,
              method: "pix",
            },
            {
              amount_in_cents: 2000,
              change_in_cents: 0,
              installment_count: 3,
              method: "credit_card",
            },
          ],
        }),
      ],
    });

    await expect(
      new SupabaseSaleDetailRepository(client).findById("sale-1"),
    ).resolves.toMatchObject({
      success: true,
      sale: {
        payments: [
          { amountInCents: 1000, changeInCents: 0, method: "pix" },
          {
            amountInCents: 2000,
            changeInCents: 0,
            installmentCount: 3,
            method: "credit_card",
          },
        ],
      },
    });
  });
  it("returns not found for absent or inaccessible sales", async () => {
    expect(
      await new SupabaseSaleDetailRepository(
        createSalesReadClient({ sales: [] }),
      ).findById("missing"),
    ).toEqual({ success: false, error: "not_found" });
  });
  it("maps errors", async () => {
    expect(
      await new SupabaseSaleDetailRepository(
        createSalesReadClient({ error: { message: "offline" } }),
      ).findById("sale-1"),
    ).toEqual({ success: false, error: "unknown" });
  });
});
