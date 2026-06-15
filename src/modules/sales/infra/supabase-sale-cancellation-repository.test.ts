import { describe, expect, it } from "vitest";

import {
  SupabaseSaleCancellationRepository,
  type SupabaseSaleCancellationClient,
} from "./supabase-sale-cancellation-repository";

type FakeSupabaseResponse = {
  data: unknown;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseSaleCancellationClient implements SupabaseSaleCancellationClient {
  public filteredColumn?: string;
  public filteredValue?: string;
  public selectedColumns?: string;
  public updatePayload?: unknown;

  constructor(
    private readonly response: FakeSupabaseResponse = {
      data: {
        id: "sale-1",
      },
      error: null,
    },
  ) {}

  from(table: "sales") {
    expect(table).toBe("sales");

    return {
      update: (payload: unknown) => {
        this.updatePayload = payload;

        return {
          eq: (column: "id", value: string) => {
            this.filteredColumn = column;
            this.filteredValue = value;

            return {
              select: (columns: string) => {
                this.selectedColumns = columns;

                return {
                  single: async () => this.response,
                };
              },
            };
          },
        };
      },
    };
  }
}

describe("SupabaseSaleCancellationRepository", () => {
  it("marks a sale as canceled", async () => {
    const supabaseClient = new FakeSupabaseSaleCancellationClient();
    const repository = new SupabaseSaleCancellationRepository(supabaseClient);

    await expect(
      repository.cancel({
        canceledAt: new Date("2026-07-10T15:00:00.000Z"),
        saleId: "sale-1",
      }),
    ).resolves.toEqual({
      success: true,
    });

    expect(supabaseClient.updatePayload).toEqual({
      canceled_at: "2026-07-10T15:00:00.000Z",
      status: "canceled",
    });
    expect(supabaseClient.filteredColumn).toBe("id");
    expect(supabaseClient.filteredValue).toBe("sale-1");
    expect(supabaseClient.selectedColumns).toBe("id");
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
});
