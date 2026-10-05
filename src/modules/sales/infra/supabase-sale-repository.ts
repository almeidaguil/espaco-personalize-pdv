import type {
  SaveSaleResult,
  SaleRepository,
} from "../application/sale-repository";
import type { Sale } from "../domain/sale";

type FinalizeSaleItemPayload = {
  product_id: string;
  quantity: number;
};

type FinalizeSalePaymentPayload = {
  amount_in_cents: number;
  change_in_cents: number;
  method: Sale["payment"]["method"];
};

type FinalizeSaleV3Args = {
  p_cash_session_id: string;
  p_items: FinalizeSaleItemPayload[];
  p_payment: FinalizeSalePaymentPayload;
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

export type SupabaseSaleClient = {
  rpc(
    functionName: "finalize_sale_v3",
    args: FinalizeSaleV3Args,
  ): SupabaseRpcResult;
};

export class SupabaseSaleRepository implements SaleRepository {
  constructor(private readonly supabaseClient: SupabaseSaleClient) {}

  async save(sale: Sale): Promise<SaveSaleResult> {
    const result = await this.supabaseClient.rpc(
      "finalize_sale_v3",
      toFinalizeSaleV3Args(sale),
    );

    if (result.error || result.data !== sale.id) {
      return {
        error: isCashSessionClosedError(result.error)
          ? "cash_session_closed"
          : "unknown",
        success: false,
      };
    }

    return {
      sale,
      success: true,
    };
  }
}

function toFinalizeSaleV3Args(sale: Sale): FinalizeSaleV3Args {
  return {
    p_cash_session_id: sale.cashSessionId,
    p_items: sale.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
    p_payment: {
      amount_in_cents: reaisToCents(sale.payment.amountInReais),
      change_in_cents: reaisToCents(sale.payment.changeInReais),
      method: sale.payment.method,
    },
    p_sale_id: sale.id,
  };
}

function isCashSessionClosedError(error: SupabaseError | null): boolean {
  const errorText =
    `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();

  return errorText.includes("there is no open cash session for this sale");
}

function reaisToCents(amountInReais: number): number {
  return Math.round(amountInReais * 100);
}
