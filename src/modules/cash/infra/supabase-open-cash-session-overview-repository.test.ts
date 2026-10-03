import { describe, expect, it } from "vitest";

import { SupabaseOpenCashSessionOverviewRepository } from "./supabase-open-cash-session-overview-repository";

type FakeRow = {
  id: string;
  opened_at: string;
  opening_amount_in_cents: number;
  operator_id: string;
  profiles: { email: string; full_name: string | null } | null;
};

class FakeSupabaseClient {
  public filters: Array<{ column: string; value: string }> = [];
  public orderedBy?: { ascending: boolean; column: string };
  public selectedColumns?: string;

  constructor(private readonly rows: FakeRow[]) {}

  from(table: "cash_sessions") {
    expect(table).toBe("cash_sessions");

    const builder = {
      eq: (column: string, value: string) => {
        this.filters.push({ column, value });

        return builder;
      },
      order: async (column: string, options: { ascending: boolean }) => {
        this.orderedBy = { ascending: options.ascending, column };

        return { data: this.rows, error: null };
      },
    };

    return {
      select: (columns: string) => {
        this.selectedColumns = columns;

        return builder;
      },
    };
  }
}

describe("SupabaseOpenCashSessionOverviewRepository", () => {
  it("maps the seller full name and reads open sessions ordered by opening time", async () => {
    const client = new FakeSupabaseClient([
      {
        id: "cash-session-12345678",
        opened_at: "2026-10-03T09:00:00.000Z",
        opening_amount_in_cents: 12550,
        operator_id: "operator-1",
        profiles: { email: "ana@example.com", full_name: "Ana Souza" },
      },
    ]);

    const result = await new SupabaseOpenCashSessionOverviewRepository(
      client,
    ).listOpen();

    expect(client.selectedColumns).toContain("profiles");
    expect(client.filters).toEqual([{ column: "status", value: "open" }]);
    expect(client.orderedBy).toEqual({ ascending: false, column: "opened_at" });
    expect(result).toEqual({
      overviews: [
        {
          id: "cash-session-12345678",
          openedAt: new Date("2026-10-03T09:00:00.000Z"),
          openingAmountInReais: 125.5,
          operatorId: "operator-1",
          operatorName: "Ana Souza",
        },
      ],
      success: true,
    });
  });

  it("falls back from missing seller full name to email and operator id", async () => {
    const client = new FakeSupabaseClient([
      {
        id: "cash-session-1",
        opened_at: "2026-10-03T09:00:00.000Z",
        opening_amount_in_cents: 0,
        operator_id: "operator-1",
        profiles: { email: "ana@example.com", full_name: "  " },
      },
      {
        id: "cash-session-2",
        opened_at: "2026-10-03T08:00:00.000Z",
        opening_amount_in_cents: 0,
        operator_id: "operator-2",
        profiles: null,
      },
    ]);

    const result = await new SupabaseOpenCashSessionOverviewRepository(
      client,
    ).listOpen();

    expect(result).toEqual({
      overviews: [
        expect.objectContaining({ operatorName: "ana@example.com" }),
        expect.objectContaining({ operatorName: "operator-2" }),
      ],
      success: true,
    });
  });
});
