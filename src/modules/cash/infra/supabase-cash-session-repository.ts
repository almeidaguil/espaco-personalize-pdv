import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "../application/cash-session-repository";
import type { CashSession, CashSessionStatus } from "../domain/cash-session";

type SupabaseCashSessionRow = {
  closed_at: string | null;
  event_id: string;
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

export type SupabaseCashSessionClient = {
  from(table: "cash_sessions"): {
    insert(payload: SupabaseCashSessionInsert): {
      select(columns: string): {
        single(): SupabaseSingleCashSessionResult;
      };
    };
    select(columns: string): {
      eq(
        column: "event_id",
        value: string,
      ): {
        eq(
          column: "operator_id",
          value: string,
        ): {
          eq(
            column: "status",
            value: "open",
          ): {
            maybeSingle(): SupabaseMaybeSingleCashSessionResult;
          };
        };
      };
    };
  };
};

const cashSessionColumns =
  "id,event_id,operator_id,opening_amount_in_cents,status,opened_at,closed_at" as const;

export class SupabaseCashSessionRepository implements CashSessionRepository {
  constructor(private readonly supabaseClient: SupabaseCashSessionClient) {}

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

function toCashSession(row: SupabaseCashSessionRow): CashSession {
  return {
    ...(row.closed_at ? { closedAt: new Date(row.closed_at) } : {}),
    eventId: row.event_id,
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
