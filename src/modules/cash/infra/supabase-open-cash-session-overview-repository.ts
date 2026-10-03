import type {
  ListOpenCashSessionOverviewsResult,
  OpenCashSessionOverview,
  OpenCashSessionOverviewRepository,
} from "../application/open-cash-session-overview-repository";

type SupabaseError = {
  message?: string;
};

type SupabaseProfileRow = {
  email: string | null;
  full_name: string | null;
};

type SupabaseOpenCashSessionOverviewRow = {
  id: string;
  opened_at: string;
  opening_amount_in_cents: number;
  operator_id: string;
  profiles: SupabaseProfileRow | null;
};

type SupabaseOpenCashSessionOverviewListResult = PromiseLike<{
  data: SupabaseOpenCashSessionOverviewRow[] | null;
  error: SupabaseError | null;
}>;

type SupabaseOpenCashSessionOverviewFilterBuilder = {
  eq(
    column: "status",
    value: "open",
  ): SupabaseOpenCashSessionOverviewFilterBuilder;
  order(
    column: "opened_at",
    options: { ascending: boolean },
  ): SupabaseOpenCashSessionOverviewListResult;
};

export type SupabaseOpenCashSessionOverviewClient = {
  from(table: "cash_sessions"): {
    select(columns: string): SupabaseOpenCashSessionOverviewFilterBuilder;
  };
};

const openCashSessionOverviewColumns =
  "id,operator_id,opening_amount_in_cents,opened_at,profiles(full_name,email)" as const;

export class SupabaseOpenCashSessionOverviewRepository implements OpenCashSessionOverviewRepository {
  constructor(
    private readonly supabaseClient: SupabaseOpenCashSessionOverviewClient,
  ) {}

  async listOpen(): Promise<ListOpenCashSessionOverviewsResult> {
    const { data, error } = await this.supabaseClient
      .from("cash_sessions")
      .select(openCashSessionOverviewColumns)
      .eq("status", "open")
      .order("opened_at", { ascending: false });

    if (error) {
      return { error: "unknown", success: false };
    }

    return {
      overviews: (data ?? []).map(toOpenCashSessionOverview),
      success: true,
    };
  }
}

function toOpenCashSessionOverview(
  row: SupabaseOpenCashSessionOverviewRow,
): OpenCashSessionOverview {
  return {
    id: row.id,
    openedAt: new Date(row.opened_at),
    openingAmountInReais: row.opening_amount_in_cents / 100,
    operatorId: row.operator_id,
    operatorName: getOperatorName(row),
  };
}

function getOperatorName(row: SupabaseOpenCashSessionOverviewRow): string {
  const fullName = row.profiles?.full_name?.trim();

  if (fullName) {
    return fullName;
  }

  const email = row.profiles?.email?.trim();

  return email || row.operator_id;
}
