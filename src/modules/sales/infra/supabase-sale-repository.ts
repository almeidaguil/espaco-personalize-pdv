import type {
  SaveSaleResult,
  SaleRepository,
} from "../application/sale-repository";
import type { PaymentMethod, Sale, SaleStatus } from "../domain/sale";

type SupabaseSaleInsert = {
  cash_session_id: string;
  completed_at: string;
  event_id: string;
  id: string;
  status: SaleStatus;
  total_in_cents: number;
};

type SupabaseSaleItemInsert = {
  product_id: string;
  product_name: string;
  quantity: number;
  sale_id: string;
  total_in_cents: number;
  unit_price_in_cents: number;
};

type SupabasePaymentInsert = {
  amount_in_cents: number;
  change_in_cents: number;
  method: PaymentMethod;
  sale_id: string;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseInsertResult = PromiseLike<{
  data: unknown;
  error: SupabaseError | null;
}>;

export type SupabaseSalesTable = {
  insert(payload: SupabaseSaleInsert): {
    select(columns: string): {
      single(): SupabaseInsertResult;
    };
  };
};

export type SupabaseSaleItemsTable = {
  insert(payload: SupabaseSaleItemInsert[]): SupabaseInsertResult;
};

export type SupabasePaymentsTable = {
  insert(payload: SupabasePaymentInsert): SupabaseInsertResult;
};

export type SupabaseSaleClient = {
  from(table: "sales"): SupabaseSalesTable;
  from(table: "sale_items"): SupabaseSaleItemsTable;
  from(table: "payments"): SupabasePaymentsTable;
};

export class SupabaseSaleRepository implements SaleRepository {
  constructor(private readonly supabaseClient: SupabaseSaleClient) {}

  async save(sale: Sale): Promise<SaveSaleResult> {
    const saleResult = await this.supabaseClient
      .from("sales")
      .insert(toSaleInsert(sale))
      .select("id")
      .single();

    if (saleResult.error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    const saleItemsResult = await this.supabaseClient
      .from("sale_items")
      .insert(sale.items.map((item) => toSaleItemInsert(sale.id, item)));

    if (saleItemsResult.error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    const paymentResult = await this.supabaseClient
      .from("payments")
      .insert(toPaymentInsert(sale));

    if (paymentResult.error) {
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

function toSaleInsert(sale: Sale): SupabaseSaleInsert {
  return {
    cash_session_id: sale.cashSessionId,
    completed_at: sale.completedAt.toISOString(),
    event_id: sale.eventId,
    id: sale.id,
    status: sale.status,
    total_in_cents: reaisToCents(sale.totalInReais),
  };
}

function toSaleItemInsert(
  saleId: string,
  item: Sale["items"][number],
): SupabaseSaleItemInsert {
  return {
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    sale_id: saleId,
    total_in_cents: reaisToCents(item.totalInReais),
    unit_price_in_cents: reaisToCents(item.unitPriceInReais),
  };
}

function toPaymentInsert(sale: Sale): SupabasePaymentInsert {
  return {
    amount_in_cents: reaisToCents(sale.payment.amountInReais),
    change_in_cents: reaisToCents(sale.payment.changeInReais),
    method: sale.payment.method,
    sale_id: sale.id,
  };
}

function reaisToCents(amountInReais: number): number {
  return Math.round(amountInReais * 100);
}
