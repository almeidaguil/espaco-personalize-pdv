import type {
  CancelSaleInput,
  CancelSaleResult,
  SaleCancellationRepository,
} from "../application/sale-cancellation-repository";

type SupabaseSaleCancellationUpdate = {
  canceled_at: string;
  status: "canceled";
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseUpdateResult = PromiseLike<{
  data: unknown;
  error: SupabaseError | null;
}>;

export type SupabaseSaleCancellationClient = {
  from(table: "sales"): {
    update(payload: SupabaseSaleCancellationUpdate): {
      eq(
        column: "id",
        value: string,
      ): {
        select(columns: string): {
          single(): SupabaseUpdateResult;
        };
      };
    };
  };
};

export class SupabaseSaleCancellationRepository implements SaleCancellationRepository {
  constructor(
    private readonly supabaseClient: SupabaseSaleCancellationClient,
  ) {}

  async cancel(input: CancelSaleInput): Promise<CancelSaleResult> {
    const { error } = await this.supabaseClient
      .from("sales")
      .update({
        canceled_at: input.canceledAt.toISOString(),
        status: "canceled",
      })
      .eq("id", input.saleId)
      .select("id")
      .single();

    if (error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      success: true,
    };
  }
}
