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
  payments: z.array(
    z.object({
      method: z.enum(["cash", "pix", "credit_card", "debit_card"]),
      amount_in_cents: z.number(),
      change_in_cents: z.number(),
    }),
  ),
});

export class SupabaseSaleDetailRepository implements SaleDetailRepository {
  constructor(private readonly supabaseClient: SupabaseSaleDetailClient) {}

  async findById(id: string): Promise<GetSaleDetailResult> {
    const { data, error } = await this.supabaseClient
      .from("sales")
      .select(
        `${saleSummaryColumns()},sale_items(product_id,product_name,quantity,unit_price_in_cents,total_in_cents),payments(method,amount_in_cents,change_in_cents)`,
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
    const payment = row.payments[0] ?? {
      amount_in_cents: 0,
      change_in_cents: 0,
      method: "cash" as const,
    };
    return {
      success: true,
      sale: {
        ...mapSaleSummary(row, names),
        items: row.sale_items.map((item) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          totalInReais: item.total_in_cents / 100,
          unitPriceInReais: item.unit_price_in_cents / 100,
        })),
        payment: {
          method: payment.method,
          amountInReais: payment.amount_in_cents / 100,
          changeInReais: payment.change_in_cents / 100,
        },
      },
    };
  }
}
