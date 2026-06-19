import { describe, expect, it } from "vitest";

import type { Sale } from "../domain/sale";
import {
  SupabaseSaleRepository,
  type SupabaseSaleClient,
} from "./supabase-sale-repository";

type FakeSupabaseResponse = {
  data: string | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseSaleClient implements SupabaseSaleClient {
  public functionName?: string;
  public rpcArgs?: unknown;

  constructor(
    private readonly rpcResponse: FakeSupabaseResponse = {
      data: "sale-1",
      error: null,
    },
  ) {}

  async rpc(functionName: "finalize_sale", args: unknown) {
    this.functionName = functionName;
    this.rpcArgs = args;

    return this.rpcResponse;
  }
}

describe("SupabaseSaleRepository", () => {
  it("finalizes sales through the atomic RPC mapping BRL values to cents", async () => {
    const supabaseClient = new FakeSupabaseSaleClient();
    const repository = new SupabaseSaleRepository(supabaseClient);
    const sale = createSale();

    await expect(repository.save(sale)).resolves.toEqual({
      sale,
      success: true,
    });

    expect(supabaseClient.functionName).toBe("finalize_sale");
    expect(supabaseClient.rpcArgs).toEqual({
      p_cash_session_id: "cash-session-1",
      p_completed_at: "2026-07-10T12:00:00.000Z",
      p_event_id: "event-1",
      p_items: [
        {
          product_id: "product-1",
          quantity: 2,
        },
      ],
      p_payment: {
        amount_in_cents: 5000,
        change_in_cents: 2000,
        method: "cash",
      },
      p_sale_id: "sale-1",
      p_total_in_cents: 3000,
    });
  });

  it("returns an error when the RPC fails", async () => {
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

  it("returns an error when the RPC returns another sale id", async () => {
    const repository = new SupabaseSaleRepository(
      new FakeSupabaseSaleClient({
        data: "another-sale",
        error: null,
      }),
    );

    await expect(repository.save(createSale())).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("maps non-cash payment methods to the RPC payload", async () => {
    const supabaseClient = new FakeSupabaseSaleClient({
      data: "sale-1",
      error: null,
    });
    const repository = new SupabaseSaleRepository(supabaseClient);
    const sale = {
      ...createSale(),
      payment: {
        amountInReais: 30,
        changeInReais: 0,
        method: "pix" as const,
      },
    };

    await expect(repository.save(sale)).resolves.toEqual({
      sale,
      success: true,
    });

    expect(supabaseClient.rpcArgs).toEqual({
      p_cash_session_id: "cash-session-1",
      p_completed_at: "2026-07-10T12:00:00.000Z",
      p_event_id: "event-1",
      p_items: [
        {
          product_id: "product-1",
          quantity: 2,
        },
      ],
      p_payment: {
        amount_in_cents: 3000,
        change_in_cents: 0,
        method: "pix",
      },
      p_sale_id: "sale-1",
      p_total_in_cents: 3000,
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
