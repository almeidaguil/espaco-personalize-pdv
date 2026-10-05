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
  id: string;
};

type SupabaseOpenCashSessionOverviewRow = {
  id: string;
  opened_at: string;
  opening_amount_in_cents: number;
  operator_id: string;
};

type SupabaseOpenCashSessionOverviewListResult = PromiseLike<{
  data: SupabaseOpenCashSessionOverviewRow[] | null;
  error: SupabaseError | null;
}>;

type SupabaseProfileListResult = PromiseLike<{
  data: SupabaseProfileRow[] | null;
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
  from(table: "profiles"): {
    select(columns: "id,full_name,email"): {
      in(column: "id", values: string[]): SupabaseProfileListResult;
    };
  };
};

const openCashSessionOverviewColumns =
  "id,operator_id,opening_amount_in_cents,opened_at" as const;

export class SupabaseOpenCashSessionOverviewRepository implements OpenCashSessionOverviewRepository {
  constructor(
    private readonly supabaseClient: SupabaseOpenCashSessionOverviewClient,
  ) {}

  async listOpen(): Promise<ListOpenCashSessionOverviewsResult> {
    const { data: cashSessionRows, error: cashSessionError } =
      await this.supabaseClient
        .from("cash_sessions")
        .select(openCashSessionOverviewColumns)
        .eq("status", "open")
        .order("opened_at", { ascending: false });

    if (cashSessionError) {
      return { error: "unknown", success: false };
    }

    const openCashSessions = cashSessionRows ?? [];

    if (openCashSessions.length === 0) {
      return { overviews: [], success: true };
    }

    const operatorIds = [
      ...new Set(openCashSessions.map((row) => row.operator_id)),
    ];

    const { data: profileRows, error: profileError } = await this.supabaseClient
      .from("profiles")
      .select("id,full_name,email")
      .in("id", operatorIds);

    if (profileError) {
      return { error: "unknown", success: false };
    }

    const profilesById = new Map(
      (profileRows ?? []).map((profile) => [profile.id, profile]),
    );

    return {
      overviews: openCashSessions.map((row) =>
        toOpenCashSessionOverview(row, profilesById),
      ),
      success: true,
    };
  }
}

function toOpenCashSessionOverview(
  row: SupabaseOpenCashSessionOverviewRow,
  profilesById: ReadonlyMap<string, SupabaseProfileRow>,
): OpenCashSessionOverview {
  return {
    id: row.id,
    openedAt: new Date(row.opened_at),
    openingAmountInReais: row.opening_amount_in_cents / 100,
    operatorId: row.operator_id,
    operatorName: getOperatorName(
      row.operator_id,
      profilesById.get(row.operator_id),
    ),
  };
}

function getOperatorName(
  operatorId: string,
  profile: SupabaseProfileRow | undefined,
): string {
  const fullName = profile?.full_name?.trim();

  if (fullName) {
    return fullName;
  }

  const email = profile?.email?.trim();

  return email || operatorId;
}
