import { describe, expect, it } from "vitest";

import { SupabaseSaleSummaryRepository } from "./supabase-sale-summary-repository";

type FakeSaleSummaryRow = {
  cash_session_id: string;
  completed_at: string;
  event_id: string;
  events: {
    name: string;
  } | null;
  id: string;
  status: "completed" | "canceled";
  total_in_cents: number;
};

type FakeSupabaseResponse = {
  data: FakeSaleSummaryRow[] | null;
  error: {
    code?: string;
    message?: string;
  } | null;
};

class FakeSupabaseSaleSummaryClient {
  public orderedColumn?: string;
  public orderOptions?: unknown;
  public selectedColumns?: string;

  constructor(private readonly response: FakeSupabaseResponse) {}

  from(table: "sales") {
    expect(table).toBe("sales");

    return {
      select: (columns: string) => {
        this.selectedColumns = columns;

        return {
          order: (column: "completed_at", options: { ascending: false }) => {
            this.orderedColumn = column;
            this.orderOptions = options;

            return Promise.resolve(this.response);
          },
        };
      },
    };
  }
}

describe("SupabaseSaleSummaryRepository", () => {
  it("lists sale summaries ordered by completion date", async () => {
    const supabaseClient = new FakeSupabaseSaleSummaryClient({
      data: [
        {
          cash_session_id: "cash-session-1",
          completed_at: "2026-07-10T12:00:00.000Z",
          event_id: "event-1",
          events: {
            name: "Evento Julho",
          },
          id: "sale-1",
          status: "completed",
          total_in_cents: 3000,
        },
      ],
      error: null,
    });
    const repository = new SupabaseSaleSummaryRepository(supabaseClient);

    await expect(repository.list()).resolves.toEqual({
      sales: [
        {
          cashSessionId: "cash-session-1",
          completedAt: new Date("2026-07-10T12:00:00.000Z"),
          eventId: "event-1",
          eventName: "Evento Julho",
          id: "sale-1",
          status: "completed",
          totalInReais: 30,
        },
      ],
      success: true,
    });
    expect(supabaseClient.selectedColumns).toBe(
      "id,event_id,cash_session_id,status,total_in_cents,completed_at,events(name)",
    );
    expect(supabaseClient.orderedColumn).toBe("completed_at");
    expect(supabaseClient.orderOptions).toEqual({ ascending: false });
  });

  it("maps repository errors", async () => {
    const repository = new SupabaseSaleSummaryRepository(
      new FakeSupabaseSaleSummaryClient({
        data: null,
        error: {
          code: "PGRST000",
          message: "Unexpected error",
        },
      }),
    );

    await expect(repository.list()).resolves.toEqual({
      error: "unknown",
      success: false,
    });
  });
});
