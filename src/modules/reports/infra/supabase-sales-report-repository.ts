import { z } from "zod";

import type {
  GetSalesReportResult,
  SalesReport,
  SalesReportFilters,
  SalesReportRepository,
} from "../application/sales-report-repository";

const paymentMethodSchema = z.enum([
  "cash",
  "pix",
  "credit_card",
  "debit_card",
]);
const cashSessionStatusSchema = z.enum(["open", "closed"]);

const reportResponseSchema = z.object({
  canceled_sales_count: z.coerce.number().int().nonnegative(),
  canceled_total_in_cents: z.coerce.number().int().nonnegative(),
  cash_difference_total_in_cents: z.coerce.number().int(),
  cash_shortage_total_in_cents: z.coerce.number().int().nonnegative(),
  cash_session_options: z.array(
    z.object({
      business_date: z.string(),
      id: z.uuid(),
      opened_at: z.string(),
      operator_id: z.uuid(),
      operator_name: z.string(),
      status: cashSessionStatusSchema,
    }),
  ),
  cash_surplus_total_in_cents: z.coerce.number().int().nonnegative(),
  completed_sales_count: z.coerce.number().int().nonnegative(),
  completed_total_in_cents: z.coerce.number().int().nonnegative(),
  end_date: z.string(),
  items_limit: z.coerce.number().int().positive(),
  items_offset: z.coerce.number().int().nonnegative(),
  items_total_count: z.coerce.number().int().nonnegative(),
  items: z.array(
    z.object({
      gross_total_in_cents: z.coerce.number().int().nonnegative(),
      product_id: z.uuid(),
      product_name: z.string(),
      quantity: z.coerce.number().int().nonnegative(),
    }),
  ),
  net_revenue_in_cents: z.coerce.number().int(),
  operator_options: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
    }),
  ),
  payment_summary: z.array(
    z.object({
      method: paymentMethodSchema,
      net_total_in_cents: z.coerce.number().int().nonnegative(),
      sales_count: z.coerce.number().int().nonnegative(),
    }),
  ),
  post_close_adjustment_payment_summary: z.array(
    z.object({
      method: paymentMethodSchema,
      net_total_in_cents: z.coerce.number().int().nonnegative(),
      sales_count: z.coerce.number().int().nonnegative(),
    }),
  ),
  post_close_adjustments_count: z.coerce.number().int().nonnegative(),
  post_close_adjustments_total_in_cents: z.coerce.number().int().nonnegative(),
  selected_cash_session_id: z.uuid().nullable(),
  selected_operator_id: z.uuid().nullable(),
  sessions_limit: z.coerce.number().int().positive(),
  sessions_offset: z.coerce.number().int().nonnegative(),
  sessions_total_count: z.coerce.number().int().nonnegative(),
  sessions: z.array(
    z.object({
      business_date: z.string(),
      canceled_sales_count: z.coerce.number().int().nonnegative(),
      canceled_total_in_cents: z.coerce.number().int().nonnegative(),
      closed_at: z.string().nullable(),
      completed_sales_count: z.coerce.number().int().nonnegative(),
      completed_total_in_cents: z.coerce.number().int().nonnegative(),
      counted_amount_in_cents: z.coerce.number().int().nonnegative().nullable(),
      difference_amount_in_cents: z.coerce.number().int().nullable(),
      expected_amount_in_cents: z.coerce
        .number()
        .int()
        .nonnegative()
        .nullable(),
      id: z.uuid(),
      opened_at: z.string(),
      opening_amount_in_cents: z.coerce.number().int().nonnegative(),
      operator_id: z.uuid(),
      operator_name: z.string(),
      status: cashSessionStatusSchema,
    }),
  ),
  start_date: z.string(),
});

type SupabaseError = {
  code?: string;
  message?: string;
};

type SupabaseReportResult = PromiseLike<{
  data: unknown;
  error: SupabaseError | null;
}>;

export type SupabaseSalesReportClient = {
  rpc(
    name: "get_store_sales_report_v2",
    parameters: {
      p_cash_session_id: string | null;
      p_end_date: string;
      p_export_mode: boolean;
      p_items_limit: number;
      p_items_offset: number;
      p_operator_id: string | null;
      p_sessions_limit: number;
      p_sessions_offset: number;
      p_start_date: string;
    },
  ): SupabaseReportResult;
};

export class SupabaseSalesReportRepository implements SalesReportRepository {
  constructor(private readonly supabaseClient: SupabaseSalesReportClient) {}

  async get(filters: SalesReportFilters): Promise<GetSalesReportResult> {
    const itemsPage = filters.itemsPage ?? 1;
    const pageSize = filters.pageSize ?? 8;
    const sessionsPage = filters.sessionsPage ?? 1;
    const result = await this.supabaseClient.rpc("get_store_sales_report_v2", {
      p_cash_session_id: filters.cashSessionId ?? null,
      p_end_date: filters.endDate,
      p_export_mode: filters.exportMode ?? false,
      p_items_limit: pageSize,
      p_items_offset: (itemsPage - 1) * pageSize,
      p_operator_id: filters.operatorId ?? null,
      p_sessions_limit: pageSize,
      p_sessions_offset: (sessionsPage - 1) * pageSize,
      p_start_date: filters.startDate,
    });

    if (result.error) {
      return {
        error: mapError(result.error),
        success: false,
      };
    }

    const parsedReport = reportResponseSchema.safeParse(result.data);

    if (!parsedReport.success) {
      return {
        error: "unknown",
        success: false,
      };
    }

    return {
      report: mapReport(parsedReport.data),
      success: true,
    };
  }
}

function mapError(
  error: SupabaseError,
): "forbidden" | "unauthorized" | "unknown" {
  if (error.code === "42501") {
    return "forbidden";
  }

  const normalizedMessage = error.message?.toLowerCase() ?? "";

  if (
    normalizedMessage.includes("authentication is required") ||
    normalizedMessage.includes("an active user is required")
  ) {
    return "unauthorized";
  }

  return "unknown";
}

function mapReport(data: z.infer<typeof reportResponseSchema>): SalesReport {
  return {
    canceledSalesCount: data.canceled_sales_count,
    canceledTotalInCents: data.canceled_total_in_cents,
    cashDifferenceTotalInCents: data.cash_difference_total_in_cents,
    cashShortageTotalInCents: data.cash_shortage_total_in_cents,
    cashSessionOptions: data.cash_session_options.map((session) => ({
      businessDate: session.business_date,
      id: session.id,
      openedAt: session.opened_at,
      operatorId: session.operator_id,
      operatorName: session.operator_name,
      status: session.status,
    })),
    cashSurplusTotalInCents: data.cash_surplus_total_in_cents,
    completedSalesCount: data.completed_sales_count,
    completedTotalInCents: data.completed_total_in_cents,
    endDate: data.end_date,
    items: data.items.map((item) => ({
      grossTotalInCents: item.gross_total_in_cents,
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
    })),
    itemsPage: data.items_offset / data.items_limit + 1,
    itemsTotalCount: data.items_total_count,
    netRevenueInCents: data.net_revenue_in_cents,
    operatorOptions: data.operator_options,
    pageSize: data.items_limit,
    paymentSummary: data.payment_summary.map((payment) => ({
      method: payment.method,
      netTotalInCents: payment.net_total_in_cents,
      salesCount: payment.sales_count,
    })),
    postCloseAdjustmentPaymentSummary:
      data.post_close_adjustment_payment_summary.map((payment) => ({
        method: payment.method,
        netTotalInCents: payment.net_total_in_cents,
        salesCount: payment.sales_count,
      })),
    postCloseAdjustmentsCount: data.post_close_adjustments_count,
    postCloseAdjustmentsTotalInCents:
      data.post_close_adjustments_total_in_cents,
    selectedCashSessionId: data.selected_cash_session_id,
    selectedOperatorId: data.selected_operator_id,
    sessions: data.sessions.map((session) => ({
      businessDate: session.business_date,
      canceledSalesCount: session.canceled_sales_count,
      canceledTotalInCents: session.canceled_total_in_cents,
      closedAt: session.closed_at,
      completedSalesCount: session.completed_sales_count,
      completedTotalInCents: session.completed_total_in_cents,
      countedAmountInCents: session.counted_amount_in_cents,
      differenceAmountInCents: session.difference_amount_in_cents,
      expectedAmountInCents: session.expected_amount_in_cents,
      id: session.id,
      openedAt: session.opened_at,
      openingAmountInCents: session.opening_amount_in_cents,
      operatorId: session.operator_id,
      operatorName: session.operator_name,
      status: session.status,
    })),
    sessionsPage: data.sessions_offset / data.sessions_limit + 1,
    sessionsTotalCount: data.sessions_total_count,
    startDate: data.start_date,
  };
}
