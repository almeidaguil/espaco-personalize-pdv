import type { SaleStatus } from "../domain/sale";
import type {
  ListSaleSummariesResult,
  SaleSummary,
  SaleSummaryRepository,
} from "../application/sale-summary-repository";

type SupabaseSaleSummaryRow = {
  completed_at: string;
  event_id: string;
  events: {
    name: string;
  } | null;
  id: string;
  status: SaleStatus;
  total_in_cents: number;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseSaleSummaryListResult = PromiseLike<{
  data: SupabaseSaleSummaryRow[] | null;
  error: SupabaseError | null;
}>;

export type SupabaseSaleSummaryClient = {
  from(table: "sales"): {
    select(columns: string): {
      order(
        column: "completed_at",
        options: { ascending: false },
      ): SupabaseSaleSummaryListResult;
    };
  };
};

const saleSummaryColumns =
  "id,event_id,status,total_in_cents,completed_at,events(name)" as const;

export class SupabaseSaleSummaryRepository implements SaleSummaryRepository {
  constructor(private readonly supabaseClient: SupabaseSaleSummaryClient) {}

  async list(): Promise<ListSaleSummariesResult> {
    const { data, error } = await this.supabaseClient
      .from("sales")
      .select(saleSummaryColumns)
      .order("completed_at", { ascending: false });

    if (error || !data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      sales: data.map(toSaleSummary),
      success: true,
    };
  }
}

function toSaleSummary(row: SupabaseSaleSummaryRow): SaleSummary {
  return {
    completedAt: new Date(row.completed_at),
    eventId: row.event_id,
    eventName: row.events?.name ?? "Evento sem nome",
    id: row.id,
    status: row.status,
    totalInReais: row.total_in_cents / 100,
  };
}
