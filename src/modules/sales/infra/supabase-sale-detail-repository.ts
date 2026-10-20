import { z } from "zod";
import type {
  GetSaleDetailResult,
  SaleDetailRepository,
} from "../application/sale-detail-repository";
import {
  loadOperatorNames,
  mapSaleSummary,
  saleSummaryColumns,
  saleSummaryRowSchema,
  type SupabaseSalesReadClient,
} from "./supabase-sales-read-model";

export type SupabaseSaleDetailClient = SupabaseSalesReadClient;
const detailSchema = saleSummaryRowSchema.extend({
  sale_items: z.array(
    z.object({
      product_id: z.string(),
      product_name: z.string(),
      quantity: z.number(),
      total_in_cents: z.number(),
      unit_price_in_cents: z.number(),
    }),
  ),
});

export class SupabaseSaleDetailRepository implements SaleDetailRepository {
  constructor(private readonly supabaseClient: SupabaseSaleDetailClient) {}

  async findById(id: string): Promise<GetSaleDetailResult> {
    const { data, error } = await this.supabaseClient
      .from("sales")
      .select(
        `${saleSummaryColumns()},sale_items(product_id,product_name,quantity,unit_price_in_cents,total_in_cents)`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return { success: false, error: "unknown" };
    if (!data) return { success: false, error: "not_found" };
    const parsed = detailSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: "unknown" };
    const row = parsed.data;
    const names = await loadOperatorNames(this.supabaseClient, [
      row.operator_id,
    ]);
    return {
      success: true,
      sale: {
        ...mapSaleSummary(row, names),
        items: row.sale_items.map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          totalInCents: item.total_in_cents,
          unitPriceInCents: item.unit_price_in_cents,
        })),
      },
    };
  }
}
