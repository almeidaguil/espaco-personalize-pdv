import type {
  CancelSaleInput,
  CancelSaleResult,
  SaleCancellationRepository,
} from "../application/sale-cancellation-repository";

type CancelSaleArgs = {
  p_admin_password?: string | null;
  p_canceled_at: string;
  p_sale_id: string;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseRpcResult = PromiseLike<{
  data: string | null;
  error: SupabaseError | null;
}>;

export type SupabaseSaleCancellationClient = {
  rpc(functionName: "cancel_sale", args: CancelSaleArgs): SupabaseRpcResult;
};

export class SupabaseSaleCancellationRepository implements SaleCancellationRepository {
  constructor(
    private readonly supabaseClient: SupabaseSaleCancellationClient,
  ) {}

  async cancel(input: CancelSaleInput): Promise<CancelSaleResult> {
    const { data, error } = await this.supabaseClient.rpc("cancel_sale", {
      p_admin_password: input.adminPassword ?? null,
      p_canceled_at: input.canceledAt.toISOString(),
      p_sale_id: input.saleId,
    });

    if (error || data !== input.saleId) {
      return {
        error: isAdminPasswordRequiredError(error)
          ? "admin_password_required"
          : "unknown",
        success: false,
      };
    }

    return {
      success: true,
    };
  }
}

function isAdminPasswordRequiredError(error: SupabaseError | null): boolean {
  const errorText =
    `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();

  return errorText.includes("admin password is required");
}
