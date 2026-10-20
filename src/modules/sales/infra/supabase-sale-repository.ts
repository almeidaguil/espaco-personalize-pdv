import type {
  SaveSaleResult,
  SaleRepository,
} from "../application/sale-repository";
import type { Sale } from "../domain/sale";
import type {
  InstallmentCount,
  PaymentMethod,
} from "@/shared/types/payment-method";

type FinalizeSaleItemPayload = {
  product_id: string;
  quantity: number;
};

type FinalizeSalePaymentPayload = {
  amount_in_cents: number;
  installment_count?: InstallmentCount;
  method: PaymentMethod;
};

type FinalizeSaleV5Args = {
  p_cash_session_id: string;
  p_discount_in_cents: number;
  p_items: FinalizeSaleItemPayload[];
  p_payments: FinalizeSalePaymentPayload[];
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
    functionName: "finalize_sale_v5",
    args: FinalizeSaleV5Args,
  ): SupabaseRpcResult;
};

export class SupabaseSaleRepository implements SaleRepository {
  constructor(private readonly supabaseClient: SupabaseSaleClient) {}

  async save(sale: Sale): Promise<SaveSaleResult> {
    const result = await this.supabaseClient.rpc(
      "finalize_sale_v5",
      toFinalizeSaleV5Args(sale),
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

function toFinalizeSaleV5Args(sale: Sale): FinalizeSaleV5Args {
  return {
    p_cash_session_id: sale.cashSessionId,
    p_discount_in_cents: sale.discountInCents,
    p_items: sale.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
    p_payments: sale.payments.map((payment) =>
      payment.method === "credit_card"
        ? {
            amount_in_cents: payment.amountInCents,
            installment_count: payment.installmentCount,
            method: payment.method,
          }
        : {
            amount_in_cents: payment.amountInCents,
            method: payment.method,
          },
    ),
    p_sale_id: sale.id,
  };
}

function isCashSessionClosedError(error: SupabaseError | null): boolean {
  const errorText =
    `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();

  return errorText.includes("there is no open cash session for this sale");
}
