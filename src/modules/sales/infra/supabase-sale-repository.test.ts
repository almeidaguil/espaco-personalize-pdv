import { describe, expect, it } from "vitest";

import type { Sale } from "../domain/sale";
import {
  SupabaseSaleRepository,
  type SupabasePaymentsTable,
  type SupabaseSaleItemsTable,
  type SupabaseSaleClient,
  type SupabaseSalesTable,
} from "./supabase-sale-repository";

type FakeSupabaseResponse = {
  data: unknown;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseSaleClient implements SupabaseSaleClient {
  public paymentPayload?: unknown;
  public saleItemsPayload?: unknown;
  public salePayload?: unknown;
  public selectedColumns?: string;

  constructor(
    private readonly saleResponse: FakeSupabaseResponse = {
      data: { id: "sale-1" },
      error: null,
    },
    private readonly saleItemsResponse: FakeSupabaseResponse = {
      data: [],
      error: null,
    },
    private readonly paymentResponse: FakeSupabaseResponse = {
      data: null,
      error: null,
    },
  ) {}

  from(table: "sales"): SupabaseSalesTable;
  from(table: "sale_items"): SupabaseSaleItemsTable;
  from(table: "payments"): SupabasePaymentsTable;
  from(
    table: "sales" | "sale_items" | "payments",
  ): SupabaseSalesTable | SupabaseSaleItemsTable | SupabasePaymentsTable {
    if (table === "sales") {
      return {
        insert: (payload: unknown) => {
          this.salePayload = payload;

          return {
            select: (columns: string) => {
              this.selectedColumns = columns;

              return {
                single: async () => this.saleResponse,
              };
            },
          };
        },
      };
    }

    if (table === "sale_items") {
      return {
        insert: async (payload: unknown) => {
          this.saleItemsPayload = payload;

          return this.saleItemsResponse;
        },
      };
    }

    return {
      insert: async (payload: unknown) => {
        this.paymentPayload = payload;

        return this.paymentResponse;
      },
    };
  }
}

describe("SupabaseSaleRepository", () => {
  it("saves sales, items and payments mapping BRL values to cents", async () => {
    const supabaseClient = new FakeSupabaseSaleClient();
    const repository = new SupabaseSaleRepository(supabaseClient);
    const sale = createSale();

    await expect(repository.save(sale)).resolves.toEqual({
      sale,
      success: true,
    });

    expect(supabaseClient.salePayload).toEqual({
      cash_session_id: "cash-session-1",
      completed_at: "2026-07-10T12:00:00.000Z",
      event_id: "event-1",
      id: "sale-1",
      status: "completed",
      total_in_cents: 3000,
    });
    expect(supabaseClient.selectedColumns).toBe("id");
    expect(supabaseClient.saleItemsPayload).toEqual([
      {
        product_id: "product-1",
        product_name: "Chaveiro Polvo",
        quantity: 2,
        sale_id: "sale-1",
        total_in_cents: 3000,
        unit_price_in_cents: 1500,
      },
    ]);
    expect(supabaseClient.paymentPayload).toEqual({
      amount_in_cents: 5000,
      change_in_cents: 2000,
      method: "cash",
      sale_id: "sale-1",
    });
  });

  it("returns an error when the sale insert fails", async () => {
    const repository = new SupabaseSaleRepository(
      new FakeSupabaseSaleClient({
        data: null,
        error: {
          code: "PGRST000",
          message: "Unexpected error",
        },
      }),
    );

    await expect(repository.save(createSale())).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("returns an error when the sale items insert fails", async () => {
    const repository = new SupabaseSaleRepository(
      new FakeSupabaseSaleClient(
        { data: { id: "sale-1" }, error: null },
        {
          data: null,
          error: {
            code: "PGRST000",
            message: "Unexpected error",
          },
        },
      ),
    );

    await expect(repository.save(createSale())).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("returns an error when the payment insert fails", async () => {
    const repository = new SupabaseSaleRepository(
      new FakeSupabaseSaleClient(
        { data: { id: "sale-1" }, error: null },
        { data: [], error: null },
        {
          data: null,
          error: {
            code: "PGRST000",
            message: "Unexpected error",
          },
        },
      ),
    );

    await expect(repository.save(createSale())).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });
});

function createSale(): Sale {
  return {
    cashSessionId: "cash-session-1",
    completedAt: new Date("2026-07-10T12:00:00.000Z"),
    eventId: "event-1",
    id: "sale-1",
    items: [
      {
        productId: "product-1",
        productName: "Chaveiro Polvo",
        quantity: 2,
        totalInReais: 30,
        unitPriceInReais: 15,
      },
    ],
    payment: {
      amountInReais: 50,
      changeInReais: 20,
      method: "cash",
    },
    status: "completed",
    totalInReais: 30,
  };
}
