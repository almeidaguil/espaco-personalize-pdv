import type { PaymentMethod, SaleStatus } from "../domain/sale";
import type {
  GetSaleDetailResult,
  SaleDetail,
  SaleDetailRepository,
} from "../application/sale-detail-repository";

type SupabaseSaleItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  total_in_cents: number;
  unit_price_in_cents: number;
};

type SupabasePaymentRow = {
  amount_in_cents: number;
  change_in_cents: number;
  method: PaymentMethod;
};

type SupabaseSaleDetailRow = {
  cash_session_id: string;
  completed_at: string;
  event_id: string;
  events: {
    name: string;
  } | null;
  id: string;
  payments: SupabasePaymentRow[];
  sale_items: SupabaseSaleItemRow[];
  status: SaleStatus;
  total_in_cents: number;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseSaleDetailResult = PromiseLike<{
  data: SupabaseSaleDetailRow | null;
  error: SupabaseError | null;
}>;

export type SupabaseSaleDetailClient = {
  from(table: "sales"): {
    select(columns: string): {
      eq(
        column: "id",
        value: string,
      ): {
        maybeSingle(): SupabaseSaleDetailResult;
      };
    };
  };
};

const saleDetailColumns =
  "id,event_id,cash_session_id,status,total_in_cents,completed_at,events(name),sale_items(product_id,product_name,quantity,unit_price_in_cents,total_in_cents),payments(method,amount_in_cents,change_in_cents)" as const;

export class SupabaseSaleDetailRepository implements SaleDetailRepository {
  constructor(private readonly supabaseClient: SupabaseSaleDetailClient) {}

  async findById(id: string): Promise<GetSaleDetailResult> {
    const { data, error } = await this.supabaseClient
      .from("sales")
      .select(saleDetailColumns)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return {
        error: "unknown",
        success: false,
      };
    }

    if (!data) {
      return {
        error: "not_found",
        success: false,
      };
    }

    return {
      sale: toSaleDetail(data),
      success: true,
    };
  }
}

function toSaleDetail(row: SupabaseSaleDetailRow): SaleDetail {
  const payment = row.payments[0] ?? {
    amount_in_cents: 0,
    change_in_cents: 0,
    method: "cash" as const,
  };

  return {
    cashSessionId: row.cash_session_id,
    completedAt: new Date(row.completed_at),
    eventId: row.event_id,
    eventName: row.events?.name ?? "Evento sem nome",
    id: row.id,
    items: row.sale_items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      totalInReais: item.total_in_cents / 100,
      unitPriceInReais: item.unit_price_in_cents / 100,
    })),
    payment: {
      amountInReais: payment.amount_in_cents / 100,
      changeInReais: payment.change_in_cents / 100,
      method: payment.method,
    },
    status: row.status,
    totalInReais: row.total_in_cents / 100,
  };
}
