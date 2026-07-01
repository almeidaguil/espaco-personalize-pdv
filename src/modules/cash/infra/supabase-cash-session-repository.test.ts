import { describe, expect, it } from "vitest";

import type { CashSessionStatus } from "../domain/cash-session";
import { SupabaseCashSessionRepository } from "./supabase-cash-session-repository";

type FakeSupabaseCashSessionRow = {
  closed_at: string | null;
  closed_by?: string | null;
  counted_amount_in_cents?: number | null;
  difference_amount_in_cents?: number | null;
  event_id: string;
  expected_amount_in_cents?: number | null;
  id: string;
  opened_at: string;
  opening_amount_in_cents: number;
  operator_id: string;
  status: CashSessionStatus;
};

type FakeSupabaseResponse = {
  data: FakeSupabaseCashSessionRow | null;
  error: {
    code?: string;
    details?: string;
    message?: string;
  } | null;
};

type FakeSupabaseListResponse = {
  data: FakeSupabaseCashSessionRow[] | null;
  error: {
    code?: string;
    details?: string;
    message?: string;
  } | null;
};

class FakeSupabaseCashSessionClient {
  public eqFilters: Array<{ column: string; value: unknown }> = [];
  public insertedPayload?: unknown;
  public orderedBy?: { ascending: boolean; column: string };
  public rpcArgs?: unknown;
  public rpcFunctionName?: string;
  public selectedColumns?: string;
  public updatedPayload?: unknown;

  constructor(
    private readonly response: FakeSupabaseResponse,
    private readonly findResponse: FakeSupabaseResponse = {
      data: null,
      error: null,
    },
    private readonly listResponse: FakeSupabaseListResponse = {
      data: [],
      error: null,
    },
    private readonly rpcResponse: {
      data: string | null;
      error: { code?: string; message?: string } | null;
    } = {
      data: "cash-session-1",
      error: null,
    },
  ) {}

  from(table: "cash_sessions") {
    expect(table).toBe("cash_sessions");

    return {
      insert: (payload: unknown) => {
        this.insertedPayload = payload;

        return {
          select: (columns: string) => {
            this.selectedColumns = columns;

            return {
              single: async () => this.response,
            };
          },
        };
      },
      select: (columns: string) => {
        this.selectedColumns = columns;

        return this.createFilterBuilder();
      },
      update: (payload: unknown) => {
        this.updatedPayload = payload;

        return {
          eq: (column: string, value: unknown) => {
            this.eqFilters.push({ column, value });

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

  async rpc(functionName: "close_cash_session", args: unknown) {
    this.rpcFunctionName = functionName;
    this.rpcArgs = args;

    return this.rpcResponse;
  }

  private createFilterBuilder() {
    const builder = {
      eq: (column: string, value: unknown) => {
        this.eqFilters.push({ column, value });

        return builder;
      },
      maybeSingle: async () => this.findResponse,
      order: async (column: string, options: { ascending: boolean }) => {
        this.orderedBy = {
          ascending: options.ascending,
          column,
        };

        return this.listResponse;
      },
    };

    return builder;
  }
}

describe("SupabaseCashSessionRepository", () => {
  it("saves a cash session mapping BRL amount to persisted cents", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient({
      data: {
        closed_at: null,
        event_id: "event-1",
        id: "cash-session-1",
        opened_at: "2026-07-10T12:00:00.000Z",
        opening_amount_in_cents: 15050,
        operator_id: "operator-1",
        status: "open",
      },
      error: null,
    });
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    const result = await repository.save({
      eventId: "event-1",
      id: "cash-session-1",
      openedAt: new Date("2026-07-10T12:00:00.000Z"),
      openingAmountInReais: 150.5,
      operatorId: "operator-1",
      status: "open",
    });

    expect(supabaseClient.insertedPayload).toEqual({
      closed_at: null,
      event_id: "event-1",
      id: "cash-session-1",
      opened_at: "2026-07-10T12:00:00.000Z",
      opening_amount_in_cents: 15050,
      operator_id: "operator-1",
      status: "open",
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.session.openingAmountInReais).toBe(150.5);
    }
  });

  it("maps open session unique violations", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "cash_sessions_one_open_per_event_operator_idx"',
      },
    });
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    await expect(
      repository.save({
        eventId: "event-1",
        id: "cash-session-1",
        openedAt: new Date("2026-07-10T12:00:00.000Z"),
        openingAmountInReais: 150.5,
        operatorId: "operator-1",
        status: "open",
      }),
    ).resolves.toEqual({
      error: "open_session_already_exists",
      success: false,
    });
  });

  it("finds an open cash session by event and operator", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient(
      { data: null, error: null },
      {
        data: {
          closed_at: null,
          event_id: "event-1",
          id: "cash-session-1",
          opened_at: "2026-07-10T12:00:00.000Z",
          opening_amount_in_cents: 15050,
          operator_id: "operator-1",
          status: "open",
        },
        error: null,
      },
    );
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    const result = await repository.findOpenByEventAndOperator({
      eventId: "event-1",
      operatorId: "operator-1",
    });

    expect(supabaseClient.eqFilters).toEqual([
      { column: "event_id", value: "event-1" },
      { column: "operator_id", value: "operator-1" },
      { column: "status", value: "open" },
    ]);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.session?.id).toBe("cash-session-1");
      expect(result.session?.openingAmountInReais).toBe(150.5);
    }
  });

  it("finds an open cash session by id and operator", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient(
      { data: null, error: null },
      {
        data: {
          closed_at: null,
          event_id: "event-1",
          id: "cash-session-1",
          opened_at: "2026-07-10T12:00:00.000Z",
          opening_amount_in_cents: 15050,
          operator_id: "operator-1",
          status: "open",
        },
        error: null,
      },
    );
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    const result = await repository.findOpenByIdAndOperator({
      cashSessionId: "cash-session-1",
      operatorId: "operator-1",
    });

    expect(supabaseClient.eqFilters).toEqual([
      { column: "id", value: "cash-session-1" },
      { column: "operator_id", value: "operator-1" },
      { column: "status", value: "open" },
    ]);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.session?.id).toBe("cash-session-1");
      expect(result.session?.openingAmountInReais).toBe(150.5);
    }
  });

  it("updates a cash session when closing it", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient(
      {
        data: null,
        error: null,
      },
      {
        data: {
          closed_at: "2026-07-10T18:00:00.000Z",
          closed_by: "operator-1",
          counted_amount_in_cents: 26075,
          difference_amount_in_cents: 1025,
          event_id: "event-1",
          expected_amount_in_cents: 25050,
          id: "cash-session-1",
          opened_at: "2026-07-10T12:00:00.000Z",
          opening_amount_in_cents: 15050,
          operator_id: "operator-1",
          status: "closed",
        },
        error: null,
      },
    );
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    const result = await repository.update(
      {
        closedAt: new Date("2026-07-10T18:00:00.000Z"),
        countedAmountInReais: 260.75,
        eventId: "event-1",
        id: "cash-session-1",
        openedAt: new Date("2026-07-10T12:00:00.000Z"),
        openingAmountInReais: 150.5,
        operatorId: "operator-1",
        status: "closed",
      },
      {
        adminPassword: "admin-password-test",
      },
    );

    expect(supabaseClient.rpcFunctionName).toBe("close_cash_session");
    expect(supabaseClient.rpcArgs).toEqual({
      p_admin_password: "admin-password-test",
      p_cash_session_id: "cash-session-1",
      p_closed_at: "2026-07-10T18:00:00.000Z",
      p_counted_amount_in_cents: 26075,
    });
    expect(supabaseClient.eqFilters).toEqual([
      { column: "id", value: "cash-session-1" },
    ]);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.session.status).toBe("closed");
      expect(result.session.closedAt).toEqual(
        new Date("2026-07-10T18:00:00.000Z"),
      );
      expect(result.session.countedAmountInReais).toBe(260.75);
      expect(result.session.expectedAmountInReais).toBe(250.5);
      expect(result.session.differenceAmountInReais).toBe(10.25);
    }
  });

  it("maps admin password RPC failures", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient(
      {
        data: null,
        error: null,
      },
      {
        data: null,
        error: null,
      },
      {
        data: [],
        error: null,
      },
      {
        data: null,
        error: {
          message:
            "Admin password is required to close a cash session with shortage.",
        },
      },
    );
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    const result = await repository.update({
      closedAt: new Date("2026-07-10T18:00:00.000Z"),
      countedAmountInReais: 200,
      eventId: "event-1",
      id: "cash-session-1",
      openedAt: new Date("2026-07-10T12:00:00.000Z"),
      openingAmountInReais: 150.5,
      operatorId: "operator-1",
      status: "closed",
    });

    expect(result).toEqual({
      error: "admin_password_required",
      success: false,
    });
  });

  it("lists open cash sessions by operator", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient(
      { data: null, error: null },
      { data: null, error: null },
      {
        data: [
          {
            closed_at: null,
            event_id: "event-1",
            id: "cash-session-1",
            opened_at: "2026-07-10T12:00:00.000Z",
            opening_amount_in_cents: 15050,
            operator_id: "operator-1",
            status: "open",
          },
        ],
        error: null,
      },
    );
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    const result = await repository.listOpenByOperator("operator-1");

    expect(supabaseClient.eqFilters).toEqual([
      { column: "operator_id", value: "operator-1" },
      { column: "status", value: "open" },
    ]);
    expect(supabaseClient.orderedBy).toEqual({
      ascending: false,
      column: "opened_at",
    });
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]?.id).toBe("cash-session-1");
    }
  });

  it("returns null when no open cash session exists", async () => {
    const supabaseClient = new FakeSupabaseCashSessionClient(
      { data: null, error: null },
      { data: null, error: null },
    );
    const repository = new SupabaseCashSessionRepository(supabaseClient);

    await expect(
      repository.findOpenByEventAndOperator({
        eventId: "event-1",
        operatorId: "operator-1",
      }),
    ).resolves.toEqual({
      session: null,
      success: true,
    });
  });
});
