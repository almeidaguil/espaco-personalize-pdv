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
  public rpcCalls = 0;
  public rpcArgs?: unknown;

  constructor(
    private readonly rpcResponse: FakeSupabaseResponse = {
      data: "sale-1",
      error: null,
    },
  ) {}

  async rpc(functionName: "finalize_sale_v3", args: unknown) {
    this.rpcCalls += 1;
    this.functionName = functionName;
    this.rpcArgs = args;

    return this.rpcResponse;
  }
}

describe("SupabaseSaleRepository", () => {
  it("finalizes sales through V3 with the exact trusted cash session", async () => {
    const supabaseClient = new FakeSupabaseSaleClient();
    const repository = new SupabaseSaleRepository(supabaseClient);
    const sale = createSale();

    await expect(repository.save(sale)).resolves.toEqual({
      sale,
      success: true,
    });

    expect(supabaseClient.functionName).toBe("finalize_sale_v3");
    expect(supabaseClient.rpcArgs).toEqual({
      p_cash_session_id: "cash-session-1",
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
    });
  });

  it("reports a closed trusted session without retrying against another session", async () => {
    const supabaseClient = new FakeSupabaseSaleClient({
      data: null,
      error: {
        message: "There is no open cash session for this sale.",
      },
    });
    const repository = new SupabaseSaleRepository(supabaseClient);

    await expect(repository.save(createSale())).resolves.toEqual({
      error: "cash_session_closed",
      success: false,
    });
    expect(supabaseClient.functionName).toBe("finalize_sale_v3");
    expect(supabaseClient.rpcCalls).toBe(1);
  });
});

function createSale(): Sale {
  return {
    cashSessionId: "cash-session-1",
    completedAt: new Date("2026-07-10T12:00:00.000Z"),
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
