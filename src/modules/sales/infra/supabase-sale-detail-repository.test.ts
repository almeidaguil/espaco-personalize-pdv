import { describe, expect, it } from "vitest";

import { SupabaseSaleDetailRepository } from "./supabase-sale-detail-repository";

type FakeSaleDetailRow = {
  cash_session_id: string;
  completed_at: string;
  event_id: string;
  events: {
    name: string;
  } | null;
  id: string;
  payments: Array<{
    amount_in_cents: number;
    change_in_cents: number;
    method: "cash";
  }>;
  sale_items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    total_in_cents: number;
    unit_price_in_cents: number;
  }>;
  status: "completed" | "canceled";
  total_in_cents: number;
};

type FakeSupabaseResponse = {
  data: FakeSaleDetailRow | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseSaleDetailClient {
  public eqColumn?: string;
  public eqValue?: string;
  public selectedColumns?: string;

  constructor(private readonly response: FakeSupabaseResponse) {}

  from(table: "sales") {
    expect(table).toBe("sales");

    return {
      select: (columns: string) => {
        this.selectedColumns = columns;

        return {
          eq: (column: "id", value: string) => {
            this.eqColumn = column;
            this.eqValue = value;

            return {
              maybeSingle: async () => this.response,
            };
          },
        };
      },
    };
  }
}

describe("SupabaseSaleDetailRepository", () => {
  it("finds sale details by id", async () => {
    const supabaseClient = new FakeSupabaseSaleDetailClient({
      data: createRow(),
      error: null,
    });
    const repository = new SupabaseSaleDetailRepository(supabaseClient);

    await expect(repository.findById("sale-1")).resolves.toEqual({
      sale: {
        cashSessionId: "cash-session-1",
        completedAt: new Date("2026-07-10T12:00:00.000Z"),
        eventId: "event-1",
        eventName: "Evento Julho",
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
      },
      success: true,
    });
    expect(supabaseClient.eqColumn).toBe("id");
    expect(supabaseClient.eqValue).toBe("sale-1");
  });

  it("returns not found when the sale does not exist", async () => {
    const repository = new SupabaseSaleDetailRepository(
      new FakeSupabaseSaleDetailClient({
        data: null,
        error: null,
      }),
    );

    await expect(repository.findById("sale-1")).resolves.toEqual({
      error: "not_found",
      success: false,
    });
  });

  it("maps repository errors", async () => {
    const repository = new SupabaseSaleDetailRepository(
      new FakeSupabaseSaleDetailClient({
        data: null,
        error: {
          code: "PGRST000",
          message: "Unexpected error",
        },
      }),
    );

    await expect(repository.findById("sale-1")).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });
});

function createRow(): FakeSaleDetailRow {
  return {
    cash_session_id: "cash-session-1",
    completed_at: "2026-07-10T12:00:00.000Z",
    event_id: "event-1",
    events: {
      name: "Evento Julho",
    },
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
        unit_price_in_cents: 1500,
      },
    ],
    status: "completed",
    total_in_cents: 3000,
  };
}
