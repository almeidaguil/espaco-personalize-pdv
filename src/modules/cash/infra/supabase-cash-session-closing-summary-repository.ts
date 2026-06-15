import type {
  CashSessionClosingSummary,
  CashSessionClosingSummaryRepository,
  ListCashSessionClosingSummariesResult,
} from "../application/cash-session-closing-summary-repository";

type SupabasePaymentRow = {
  amount_in_cents: number;
  change_in_cents: number;
  method: "cash";
};

type SupabaseSaleRow = {
  cash_session_id: string;
  payments: SupabasePaymentRow[];
  status: "canceled" | "completed";
  total_in_cents: number;
};

type SupabaseCashSessionRow = {
  id: string;
  opening_amount_in_cents: number;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseCashSessionFilterBuilder = {
  in(
    column: "id",
    value: string[],
  ): PromiseLike<{
    data: SupabaseCashSessionRow[] | null;
    error: SupabaseError | null;
  }>;
};

type SupabaseSalesFilterBuilder = {
  in(
    column: "cash_session_id",
    value: string[],
  ): PromiseLike<{
    data: SupabaseSaleRow[] | null;
    error: SupabaseError | null;
  }>;
};

export type SupabaseCashSessionClosingSummaryClient = {
  from(table: "cash_sessions"): {
    select(
      columns: "id,opening_amount_in_cents",
    ): SupabaseCashSessionFilterBuilder;
  };
  from(table: "sales"): {
    select(
      columns: "cash_session_id,status,total_in_cents,payments(amount_in_cents,change_in_cents,method)",
    ): SupabaseSalesFilterBuilder;
  };
};

export class SupabaseCashSessionClosingSummaryRepository implements CashSessionClosingSummaryRepository {
  constructor(
    private readonly supabaseClient: SupabaseCashSessionClosingSummaryClient,
  ) {}

  async listByCashSessionIds(
    cashSessionIds: string[],
  ): Promise<ListCashSessionClosingSummariesResult> {
    const uniqueIds = Array.from(new Set(cashSessionIds));
    const [cashSessionsResult, salesResult] = await Promise.all([
      this.supabaseClient
        .from("cash_sessions")
        .select("id,opening_amount_in_cents")
        .in("id", uniqueIds),
      this.supabaseClient
        .from("sales")
        .select(
          "cash_session_id,status,total_in_cents,payments(amount_in_cents,change_in_cents,method)",
        )
        .in("cash_session_id", uniqueIds),
    ]);

    if (cashSessionsResult.error || salesResult.error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    const summaries = new Map<string, CashSessionClosingSummary>();

    for (const cashSession of cashSessionsResult.data ?? []) {
      const openingAmountInReais = centsToReais(
        cashSession.opening_amount_in_cents,
      );

      summaries.set(cashSession.id, {
        canceledSalesCount: 0,
        canceledSalesTotalInReais: 0,
        cashSessionId: cashSession.id,
        completedSalesCount: 0,
        completedSalesTotalInReais: 0,
        expectedAmountInReais: openingAmountInReais,
        openingAmountInReais,
      });
    }

    for (const sale of salesResult.data ?? []) {
      const summary = summaries.get(sale.cash_session_id);

      if (!summary) {
        continue;
      }

      if (sale.status === "completed") {
        const cashPaymentTotal = sale.payments
          .filter((payment) => payment.method === "cash")
          .reduce(
            (total, payment) =>
              total + payment.amount_in_cents - payment.change_in_cents,
            0,
          );

        summary.completedSalesCount += 1;
        summary.completedSalesTotalInReais = roundBrl(
          summary.completedSalesTotalInReais + centsToReais(cashPaymentTotal),
        );
        summary.expectedAmountInReais = roundBrl(
          summary.openingAmountInReais + summary.completedSalesTotalInReais,
        );
      }

      if (sale.status === "canceled") {
        summary.canceledSalesCount += 1;
        summary.canceledSalesTotalInReais = roundBrl(
          summary.canceledSalesTotalInReais + centsToReais(sale.total_in_cents),
        );
      }
    }

    return {
      summaries: Array.from(summaries.values()),
      success: true,
    };
  }
}

function centsToReais(value: number): number {
  return roundBrl(value / 100);
}

function roundBrl(value: number): number {
  return Math.round(value * 100) / 100;
}
