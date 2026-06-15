import type { SaleStatus } from "@/modules/sales/domain/sale";

import type {
  GetSalesByEventReportResult,
  SalesByEventProductReportItem,
  SalesByEventReportRepository,
} from "../application/sales-by-event-report-repository";

type SupabaseEventRow = {
  id: string;
  name: string;
};

type SupabaseSaleItemRow = {
  product_id: string;
  product_name: string;
  quantity: number;
  total_in_cents: number;
};

type SupabaseSaleRow = {
  id: string;
  sale_items: SupabaseSaleItemRow[];
  status: SaleStatus;
  total_in_cents: number;
};

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseEventResult = PromiseLike<{
  data: SupabaseEventRow | null;
  error: SupabaseError | null;
}>;

type SupabaseSalesResult = PromiseLike<{
  data: SupabaseSaleRow[] | null;
  error: SupabaseError | null;
}>;

export type SupabaseSalesByEventReportClient = {
  from(table: "events"): {
    select(columns: string): {
      eq(
        column: "id",
        value: string,
      ): {
        maybeSingle(): SupabaseEventResult;
      };
    };
  };
  from(table: "sales"): {
    select(columns: string): {
      eq(column: "event_id", value: string): SupabaseSalesResult;
    };
  };
};

const eventColumns = "id,name" as const;
const saleColumns =
  "id,status,total_in_cents,sale_items(product_id,product_name,quantity,total_in_cents)" as const;

export class SupabaseSalesByEventReportRepository implements SalesByEventReportRepository {
  constructor(
    private readonly supabaseClient: SupabaseSalesByEventReportClient,
  ) {}

  async getByEventId(eventId: string): Promise<GetSalesByEventReportResult> {
    const [eventResult, salesResult] = await Promise.all([
      this.supabaseClient
        .from("events")
        .select(eventColumns)
        .eq("id", eventId)
        .maybeSingle(),
      this.supabaseClient
        .from("sales")
        .select(saleColumns)
        .eq("event_id", eventId),
    ]);

    if (eventResult.error || salesResult.error || !salesResult.data) {
      return {
        error: "unknown",
        success: false,
      };
    }

    if (!eventResult.data) {
      return {
        error: "not_found",
        success: false,
      };
    }

    const completedSales = salesResult.data.filter(
      (sale) => sale.status === "completed",
    );
    const canceledSales = salesResult.data.filter(
      (sale) => sale.status === "canceled",
    );

    return {
      report: {
        canceledSalesCount: canceledSales.length,
        canceledTotalInReais: centsToReais(
          canceledSales.reduce((total, sale) => total + sale.total_in_cents, 0),
        ),
        completedSalesCount: completedSales.length,
        eventId: eventResult.data.id,
        eventName: eventResult.data.name,
        grossTotalInReais: centsToReais(
          completedSales.reduce(
            (total, sale) => total + sale.total_in_cents,
            0,
          ),
        ),
        items: summarizeCompletedSaleItems(completedSales),
      },
      success: true,
    };
  }
}

function summarizeCompletedSaleItems(
  completedSales: SupabaseSaleRow[],
): SalesByEventProductReportItem[] {
  const items = new Map<string, SalesByEventProductReportItem>();

  for (const sale of completedSales) {
    for (const item of sale.sale_items) {
      const currentItem = items.get(item.product_id);

      if (!currentItem) {
        items.set(item.product_id, {
          grossTotalInReais: centsToReais(item.total_in_cents),
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
        });
        continue;
      }

      items.set(item.product_id, {
        ...currentItem,
        grossTotalInReais: centsToReais(
          Math.round(currentItem.grossTotalInReais * 100) + item.total_in_cents,
        ),
        quantity: currentItem.quantity + item.quantity,
      });
    }
  }

  return Array.from(items.values()).sort((firstItem, secondItem) =>
    firstItem.productName.localeCompare(secondItem.productName, "pt-BR"),
  );
}

function centsToReais(amountInCents: number): number {
  return amountInCents / 100;
}
