import { describe, expect, it } from "vitest";

import {
  SupabaseSaleCancellationRepository,
  type SupabaseSaleCancellationClient,
} from "./supabase-sale-cancellation-repository";

type FakeSupabaseResponse = {
  data: string | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseSaleCancellationClient implements SupabaseSaleCancellationClient {
  public functionName?: string;
  public rpcArgs?: unknown;

  constructor(
    private readonly response: FakeSupabaseResponse = {
      data: "sale-1",
      error: null,
    },
  ) {}

  async rpc(functionName: "cancel_sale", args: unknown) {
    this.functionName = functionName;
    this.rpcArgs = args;

    return this.response;
  }
}

describe("SupabaseSaleCancellationRepository", () => {
  it("marks a sale as canceled", async () => {
    const supabaseClient = new FakeSupabaseSaleCancellationClient();
    const repository = new SupabaseSaleCancellationRepository(supabaseClient);

    await expect(
      repository.cancel({
        adminPassword: "123456",
        canceledAt: new Date("2026-07-10T15:00:00.000Z"),
        saleId: "sale-1",
      }),
    ).resolves.toEqual({
      success: true,
    });

    expect(supabaseClient.functionName).toBe("cancel_sale");
    expect(supabaseClient.rpcArgs).toEqual({
      p_admin_password: "123456",
      p_canceled_at: "2026-07-10T15:00:00.000Z",
      p_sale_id: "sale-1",
    });
  });

  it("returns an error when the sale update fails", async () => {
    const repository = new SupabaseSaleCancellationRepository(
      new FakeSupabaseSaleCancellationClient({
        data: null,
        error: {
          code: "PGRST000",
          message: "Unexpected error",
        },
      }),
    );

    await expect(
      repository.cancel({
        canceledAt: new Date("2026-07-10T15:00:00.000Z"),
        saleId: "sale-1",
      }),
    ).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("returns an error when the RPC returns another sale id", async () => {
    const repository = new SupabaseSaleCancellationRepository(
      new FakeSupabaseSaleCancellationClient({
        data: "another-sale",
        error: null,
      }),
    );

    await expect(
      repository.cancel({
        canceledAt: new Date("2026-07-10T15:00:00.000Z"),
        saleId: "sale-1",
      }),
    ).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });

  it("maps admin password RPC failures", async () => {
    const repository = new SupabaseSaleCancellationRepository(
      new FakeSupabaseSaleCancellationClient({
        data: null,
        error: {
          message: "Admin password is required to cancel a sale.",
        },
      }),
    );

    await expect(
      repository.cancel({
        canceledAt: new Date("2026-07-10T15:00:00.000Z"),
        saleId: "sale-1",
      }),
    ).resolves.toEqual({
      error: "admin_password_required",
      success: false,
    });
  });
});
