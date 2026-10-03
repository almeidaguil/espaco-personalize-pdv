import { describe, expect, it } from "vitest";

import { SupabaseOpenCashSessionOverviewRepository } from "./supabase-open-cash-session-overview-repository";

type FakeCashSessionRow = {
  id: string;
  opened_at: string;
  opening_amount_in_cents: number;
  operator_id: string;
};

type FakeProfileRow = {
  email: string | null;
  full_name: string | null;
  id: string;
};

type FakeError = { message: string } | null;

class FakeSupabaseClient {
  public cashSessionFilters: Array<{ column: string; value: string }> = [];
  public orderedBy?: { ascending: boolean; column: string };
  public queries: Array<{
    columns: string;
    table: "cash_sessions" | "profiles";
  }> = [];

  constructor(
    private readonly cashSessionRows: FakeCashSessionRow[],
    private readonly profileRows: FakeProfileRow[],
    private readonly errors: {
      cashSessions?: FakeError;
      profiles?: FakeError;
    } = {},
  ) {}

  from(table: "cash_sessions"): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          options: { ascending: boolean },
        ): Promise<{ data: FakeCashSessionRow[] | null; error: FakeError }>;
      };
    };
  };
  from(table: "profiles"): {
    select(
      columns: string,
    ): Promise<{ data: FakeProfileRow[] | null; error: FakeError }>;
  };
  from(table: "cash_sessions" | "profiles") {
    if (table === "profiles") {
      return {
        select: async (columns: string) => {
          this.queries.push({ columns, table });

          return {
            data: this.errors.profiles ? null : this.profileRows,
            error: this.errors.profiles ?? null,
          };
        },
      };
    }

    return {
      select: (columns: string) => {
        this.queries.push({ columns, table });

        return {
          eq: (column: string, value: string) => {
            this.cashSessionFilters.push({ column, value });

            return {
              order: async (
                orderColumn: string,
                options: { ascending: boolean },
              ) => {
                this.orderedBy = {
                  ascending: options.ascending,
                  column: orderColumn,
                };

                return {
                  data: this.errors.cashSessions ? null : this.cashSessionRows,
                  error: this.errors.cashSessions ?? null,
                };
              },
            };
          },
        };
      },
    };
  }
}

describe("SupabaseOpenCashSessionOverviewRepository", () => {
  it("merges separately queried sessions and profiles by operator id", async () => {
    const client = new FakeSupabaseClient(
      [
        {
          id: "cash-session-12345678",
          opened_at: "2026-10-03T09:00:00.000Z",
          opening_amount_in_cents: 12550,
          operator_id: "operator-1",
        },
      ],
      [
        {
          email: "ana@example.com",
          full_name: "Ana Souza",
          id: "operator-1",
        },
      ],
    );

    const result = await new SupabaseOpenCashSessionOverviewRepository(
      client,
    ).listOpen();

    expect(client.queries).toEqual([
      {
        columns: "id,operator_id,opening_amount_in_cents,opened_at",
        table: "cash_sessions",
      },
      {
        columns: "id,full_name,email",
        table: "profiles",
      },
    ]);
    expect(client.queries[0]?.columns).not.toContain("profiles(");
    expect(client.cashSessionFilters).toEqual([
      { column: "status", value: "open" },
    ]);
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
    const client = new FakeSupabaseClient(
      [
        {
          id: "cash-session-1",
          opened_at: "2026-10-03T09:00:00.000Z",
          opening_amount_in_cents: 0,
          operator_id: "operator-1",
        },
        {
          id: "cash-session-2",
          opened_at: "2026-10-03T08:00:00.000Z",
          opening_amount_in_cents: 0,
          operator_id: "operator-2",
        },
      ],
      [
        {
          email: "ana@example.com",
          full_name: "  ",
          id: "operator-1",
        },
      ],
    );

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

  it("returns an unknown error when the RLS-visible profile query fails", async () => {
    const client = new FakeSupabaseClient([], [], {
      profiles: { message: "profile query failed" },
    });

    await expect(
      new SupabaseOpenCashSessionOverviewRepository(client).listOpen(),
    ).resolves.toEqual({ error: "unknown", success: false });
  });

  it("returns an unknown error without querying profiles when sessions fail", async () => {
    const client = new FakeSupabaseClient([], [], {
      cashSessions: { message: "cash session query failed" },
    });

    await expect(
      new SupabaseOpenCashSessionOverviewRepository(client).listOpen(),
    ).resolves.toEqual({ error: "unknown", success: false });
    expect(client.queries).toEqual([
      {
        columns: "id,operator_id,opening_amount_in_cents,opened_at",
        table: "cash_sessions",
      },
    ]);
  });
});
