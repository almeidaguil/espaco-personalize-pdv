import { z } from "zod";
import type {
  ListSaleSummariesResult,
  SaleSummary,
  SaleSummaryRepository,
} from "../application/sale-summary-repository";
import type {
  ListSalesHistoryResult,
  SalesHistoryFilters,
  SalesHistoryRepository,
} from "../application/sales-history-repository";
import {
  loadOperatorNames,
  mapSaleSummary,
  operatorName,
  saleSummaryColumns,
  saleSummaryRowSchema,
  type SupabaseSalesReadClient,
} from "./supabase-sales-read-model";

export type SupabaseSaleSummaryClient = SupabaseSalesReadClient;
const batchSize = 500;
const sessionSchema = z.object({
  id: z.string(),
  operator_id: z.string(),
  business_date: z.iso.date(),
  opened_at: z.iso.datetime({ offset: true }),
});

export class SupabaseSaleSummaryRepository
  implements SaleSummaryRepository, SalesHistoryRepository
{
  constructor(private readonly supabaseClient: SupabaseSaleSummaryClient) {}

  // The dashboard needs the complete set to calculate its current cash totals.
  async list(): Promise<ListSaleSummariesResult> {
    const sales: SaleSummary[] = [];
    for (let page = 1; ; page += 1) {
      const result = await this.listPage({ page, pageSize: batchSize });
      if (!result.success) return result;
      sales.push(...result.sales);
      if (sales.length >= result.totalCount) return { success: true, sales };
      if (result.sales.length === 0)
        return { success: false, error: "unknown" };
    }
  }

  async listPage(
    filters: SalesHistoryFilters,
  ): Promise<ListSalesHistoryResult> {
    let query = this.supabaseClient
      .from("sales")
      .select(
        saleSummaryColumns(Boolean(filters.startDate || filters.endDate)),
        { count: "exact" },
      );
    if (filters.startDate)
      query = query.gte("cash_sessions.business_date", filters.startDate);
    if (filters.endDate)
      query = query.lte("cash_sessions.business_date", filters.endDate);
    if (filters.operatorId) query = query.eq("operator_id", filters.operatorId);
    if (filters.cashSessionId)
      query = query.eq("cash_session_id", filters.cashSessionId);
    if (filters.status) query = query.eq("status", filters.status);
    const start = (filters.page - 1) * filters.pageSize;
    const response = await query
      .order("completed_at", { ascending: false })
      .order("id", { ascending: false })
      .range(start, start + filters.pageSize - 1);
    const parsed = z.array(saleSummaryRowSchema).safeParse(response.data);
    if (response.error || !parsed.success || response.count == null)
      return { success: false, error: "unknown" };
    const names = await loadOperatorNames(
      this.supabaseClient,
      parsed.data.map((row) => row.operator_id),
    );
    return {
      success: true,
      sales: parsed.data.map((row) => mapSaleSummary(row, names)),
      totalCount: response.count,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  async listFilterOptions(
    filters: SalesHistoryFilters,
  ): ReturnType<SalesHistoryRepository["listFilterOptions"]> {
    const rows: z.infer<typeof sessionSchema>[] = [];
    for (let start = 0; ; start += batchSize) {
      let query = this.supabaseClient
        .from("cash_sessions")
        .select("id,operator_id,business_date,opened_at");
      if (filters.startDate)
        query = query.gte("business_date", filters.startDate);
      if (filters.endDate) query = query.lte("business_date", filters.endDate);
      const response = await query
        .order("opened_at", { ascending: false })
        .order("id", { ascending: false })
        .range(start, start + batchSize - 1);
      const parsed = z.array(sessionSchema).safeParse(response.data);
      if (response.error || !parsed.success)
        return { success: false, error: "unknown" };
      rows.push(...parsed.data);
      if (parsed.data.length < batchSize) break;
    }
    const names = await loadOperatorNames(
      this.supabaseClient,
      rows.map((row) => row.operator_id),
    );
    return {
      success: true,
      options: {
        operators: [...new Set(rows.map((row) => row.operator_id))].map(
          (id) => ({ id, name: operatorName(id, names) }),
        ),
        sessions: rows
          .filter(
            (row) =>
              !filters.operatorId || row.operator_id === filters.operatorId,
          )
          .map((row) => ({
            id: row.id,
            operatorId: row.operator_id,
            operatorName: operatorName(row.operator_id, names),
            businessDate: row.business_date,
            openedAt: new Date(row.opened_at),
          })),
      },
    };
  }
}
