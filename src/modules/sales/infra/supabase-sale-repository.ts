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

type FinalizeSaleArgs = {
  p_cash_session_id: string;
  p_completed_at: string;
  p_event_id: string;
  p_items: FinalizeSaleItemPayload[];
  p_payment: FinalizeSalePaymentPayload;
  p_sale_id: string;
  p_total_in_cents: number;
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
  rpc(functionName: "finalize_sale", args: FinalizeSaleArgs): SupabaseRpcResult;
};

export class SupabaseSaleRepository implements SaleRepository {
  constructor(private readonly supabaseClient: SupabaseSaleClient) {}

  async save(sale: Sale): Promise<SaveSaleResult> {
    const result = await this.supabaseClient.rpc(
      "finalize_sale",
      toFinalizeSaleArgs(sale),
    );

    if (result.error || result.data !== sale.id) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      sale,
      success: true,
    };
  }
}

function toFinalizeSaleArgs(sale: Sale): FinalizeSaleArgs {
  return {
    p_cash_session_id: sale.cashSessionId,
    p_completed_at: sale.completedAt.toISOString(),
    p_event_id: sale.eventId,
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
    p_total_in_cents: reaisToCents(sale.totalInReais),
  };
}

function reaisToCents(amountInReais: number): number {
  return Math.round(amountInReais * 100);
}
