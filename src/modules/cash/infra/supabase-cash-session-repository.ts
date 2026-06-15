import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  ListOpenCashSessionsResult,
  SaveCashSessionResult,
} from "../application/cash-session-repository";
import type { CashSession, CashSessionStatus } from "../domain/cash-session";

type SupabaseCashSessionRow = {
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

type SupabaseCashSessionInsert = {
  closed_at: string | null;
  event_id: string;
  id: string;
  opened_at: string;
  opening_amount_in_cents: number;
  operator_id: string;
  status: CashSessionStatus;
};

type SupabaseCashSessionUpdate = {
  p_cash_session_id: string;
  p_closed_at: string;
  p_counted_amount_in_cents: number;
};

type SupabaseError = {
  code?: string;
  details?: string;
  message?: string;
};

type SupabaseSingleCashSessionResult = PromiseLike<{
  data: SupabaseCashSessionRow | null;
  error: SupabaseError | null;
}>;

type SupabaseMaybeSingleCashSessionResult = PromiseLike<{
  data: SupabaseCashSessionRow | null;
  error: SupabaseError | null;
}>;

type SupabaseCashSessionListResult = PromiseLike<{
  data: SupabaseCashSessionRow[] | null;
  error: SupabaseError | null;
}>;

type SupabaseCashSessionFilterBuilder = {
  eq(
    column: "event_id" | "id" | "operator_id" | "status",
    value: string,
  ): SupabaseCashSessionFilterBuilder;
  maybeSingle(): SupabaseMaybeSingleCashSessionResult;
  order(
    column: "opened_at",
    options: { ascending: boolean },
  ): SupabaseCashSessionListResult;
};

export type SupabaseCashSessionClient = {
  from(table: "cash_sessions"): {
    insert(payload: SupabaseCashSessionInsert): {
      select(columns: string): {
        single(): SupabaseSingleCashSessionResult;
      };
    };
    select(columns: string): SupabaseCashSessionFilterBuilder;
    update(payload: SupabaseCashSessionUpdate): {
      eq(
        column: "id",
        value: string,
      ): {
        select(columns: string): {
          single(): SupabaseSingleCashSessionResult;
        };
      };
    };
  };
  rpc(
    functionName: "close_cash_session",
    args: SupabaseCashSessionUpdate,
  ): PromiseLike<{
    data: string | null;
    error: SupabaseError | null;
  }>;
};

const cashSessionColumns =
  "id,event_id,operator_id,opening_amount_in_cents,status,opened_at,closed_at,counted_amount_in_cents,expected_amount_in_cents,difference_amount_in_cents,closed_by" as const;

export class SupabaseCashSessionRepository implements CashSessionRepository {
  constructor(private readonly supabaseClient: SupabaseCashSessionClient) {}

  async findOpenByIdAndOperator(input: {
    cashSessionId: string;
    operatorId: string;
  }): Promise<FindOpenCashSessionResult> {
    const { data, error } = await this.supabaseClient
      .from("cash_sessions")
      .select(cashSessionColumns)
      .eq("id", input.cashSessionId)
      .eq("operator_id", input.operatorId)
      .eq("status", "open")
      .maybeSingle();

    if (error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      session: data ? toCashSession(data) : null,
      success: true,
    };
  }

  async findOpenByEventAndOperator(input: {
    eventId: string;
    operatorId: string;
  }): Promise<FindOpenCashSessionResult> {
    const { data, error } = await this.supabaseClient
      .from("cash_sessions")
      .select(cashSessionColumns)
      .eq("event_id", input.eventId)
      .eq("operator_id", input.operatorId)
      .eq("status", "open")
      .maybeSingle();

    if (error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      session: data ? toCashSession(data) : null,
      success: true,
    };
  }

  async listOpenByOperator(
    operatorId: string,
  ): Promise<ListOpenCashSessionsResult> {
    const { data, error } = await this.supabaseClient
      .from("cash_sessions")
      .select(cashSessionColumns)
      .eq("operator_id", operatorId)
      .eq("status", "open")
      .order("opened_at", { ascending: false });

    if (error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      sessions: (data ?? []).map(toCashSession),
      success: true,
    };
  }

  async save(session: CashSession): Promise<SaveCashSessionResult> {
    const { data, error } = await this.supabaseClient
      .from("cash_sessions")
      .insert(toCashSessionInsert(session))
      .select(cashSessionColumns)
      .single();

    if (error || !data) {
      return {
        error: isOpenSessionUniqueViolation(error)
          ? "open_session_already_exists"
          : "unknown",
        success: false,
      };
    }

    return {
      session: toCashSession(data),
      success: true,
    };
  }

  async update(session: CashSession): Promise<SaveCashSessionResult> {
    if (!session.closedAt || session.countedAmountInReais === undefined) {
      return {
        error: "unknown",
        success: false,
      };
    }

    const { data: closedSessionId, error: closeError } =
      await this.supabaseClient.rpc(
        "close_cash_session",
        toCashSessionUpdate(session),
      );

    if (closeError || closedSessionId !== session.id) {
      return {
        error: "unknown",
        success: false,
      };
    }

    const { data, error } = await this.supabaseClient
      .from("cash_sessions")
      .select(cashSessionColumns)
      .eq("id", session.id)
      .maybeSingle();

    if (error || !data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      session: toCashSession(data),
      success: true,
    };
  }
}

function toCashSessionInsert(session: CashSession): SupabaseCashSessionInsert {
  return {
    closed_at: session.closedAt?.toISOString() ?? null,
    event_id: session.eventId,
    id: session.id,
    opened_at: session.openedAt.toISOString(),
    opening_amount_in_cents: Math.round(session.openingAmountInReais * 100),
    operator_id: session.operatorId,
    status: session.status,
  };
}

function toCashSessionUpdate(session: CashSession): SupabaseCashSessionUpdate {
  return {
    p_cash_session_id: session.id,
    p_closed_at: session.closedAt?.toISOString() ?? "",
    p_counted_amount_in_cents: Math.round(
      (session.countedAmountInReais ?? Number.NaN) * 100,
    ),
  };
}

function toCashSession(row: SupabaseCashSessionRow): CashSession {
  return {
    ...(row.closed_at ? { closedAt: new Date(row.closed_at) } : {}),
    ...(row.closed_by ? { closedBy: row.closed_by } : {}),
    ...(row.counted_amount_in_cents != null
      ? { countedAmountInReais: row.counted_amount_in_cents / 100 }
      : {}),
    ...(row.difference_amount_in_cents != null
      ? { differenceAmountInReais: row.difference_amount_in_cents / 100 }
      : {}),
    eventId: row.event_id,
    ...(row.expected_amount_in_cents != null
      ? { expectedAmountInReais: row.expected_amount_in_cents / 100 }
      : {}),
    id: row.id,
    openedAt: new Date(row.opened_at),
    openingAmountInReais: row.opening_amount_in_cents / 100,
    operatorId: row.operator_id,
    status: row.status,
  };
}

function isOpenSessionUniqueViolation(error: SupabaseError | null): boolean {
  const errorText = `${error?.code ?? ""} ${error?.details ?? ""} ${
    error?.message ?? ""
  }`.toLowerCase();

  return errorText.includes("23505") && errorText.includes("open");
}
