import { describe, expect, it } from "vitest";
import { SupabaseSaleDetailRepository } from "./supabase-sale-detail-repository";
import { createSalesReadClient } from "../testing/sales-read-client";

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
        items: [{ productName: "Camiseta", quantity: 2, totalInReais: 30 }],
        payment: { method: "cash", amountInReais: 50, changeInReais: 20 },
      },
    });
    expect(client.calls).toContainEqual(["eq", "id", "sale-1"]);
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
