import { z } from "zod";
import type { SaleSummary } from "../application/sale-summary-repository";
import type { Payment } from "../domain/sale";

type ReadError = { code?: string; message?: string };
export type SalesReadQuery = PromiseLike<{
  data: unknown[] | null;
  error: ReadError | null;
  count?: number | null;
}> & {
  select(columns: string, options?: { count: "exact" }): SalesReadQuery;
  eq(column: string, value: string): SalesReadQuery;
  gte(column: string, value: string): SalesReadQuery;
  lte(column: string, value: string): SalesReadQuery;
  in(column: string, values: string[]): SalesReadQuery;
  order(column: string, options: { ascending: boolean }): SalesReadQuery;
  range(from: number, to: number): SalesReadQuery;
  maybeSingle(): PromiseLike<{ data: unknown | null; error: ReadError | null }>;
};
export type SupabaseSalesReadClient = {
  from(table: "sales" | "profiles" | "cash_sessions"): SalesReadQuery;
};

const paymentRowSchema = z.discriminatedUnion("method", [
  z.object({
    amount_in_cents: z.number().int().positive(),
    change_in_cents: z.number().int().nonnegative(),
    installment_count: z.null(),
    method: z.literal("cash"),
  }),
  z.object({
    amount_in_cents: z.number().int().positive(),
    change_in_cents: z.literal(0),
    installment_count: z.null(),
    method: z.literal("pix"),
  }),
  z.object({
    amount_in_cents: z.number().int().positive(),
    change_in_cents: z.literal(0),
    installment_count: z.null(),
    method: z.literal("debit_card"),
  }),
  z.object({
    amount_in_cents: z.number().int().positive(),
    change_in_cents: z.literal(0),
    installment_count: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    method: z.literal("credit_card"),
  }),
]);

export const saleSummaryRowSchema = z.object({
  id: z.string(),
  cash_session_id: z.string(),
  operator_id: z.string(),
  completed_at: z.iso.datetime({ offset: true }),
  status: z.enum(["completed", "canceled"]),
  subtotal_in_cents: z.number().int().positive(),
  discount_in_cents: z.number().int().nonnegative(),
  total_in_cents: z.number().int().positive(),
  payments: z.array(paymentRowSchema).min(1),
  cash_sessions: z
    .object({
      business_date: z.iso.date(),
      opened_at: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});

export function saleSummaryColumns(inner = false): string {
  return `id,cash_session_id,operator_id,status,subtotal_in_cents,discount_in_cents,total_in_cents,completed_at,cash_sessions${inner ? "!inner" : ""}(business_date,opened_at),payments(method,amount_in_cents,change_in_cents,installment_count)`;
}

export async function loadOperatorNames(
  client: SupabaseSalesReadClient,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const uniqueIds = [...new Set(ids)];
  for (let start = 0; start < uniqueIds.length; start += 100) {
    const response = await client
      .from("profiles")
      .select("id,full_name")
      .in("id", uniqueIds.slice(start, start + 100));
    if (response.error || !response.data) continue;
    const parsed = z
      .array(z.object({ id: z.string(), full_name: z.string().nullable() }))
      .safeParse(response.data);
    if (parsed.success) {
      for (const profile of parsed.data) {
        if (profile.full_name?.trim())
          names.set(profile.id, profile.full_name.trim());
      }
    }
  }
  return names;
}

export function operatorName(id: string, names: Map<string, string>): string {
  return names.get(id) ?? `Operador ${id.slice(0, 8)}`;
}

export function mapSaleSummary(
  row: z.infer<typeof saleSummaryRowSchema>,
  names: Map<string, string>,
): SaleSummary {
  return {
    id: row.id,
    cashSessionId: row.cash_session_id,
    operatorId: row.operator_id,
    operatorName: operatorName(row.operator_id, names),
    payments: row.payments.map(mapPayment),
    businessDate: row.cash_sessions?.business_date ?? null,
    cashSessionOpenedAt: row.cash_sessions
      ? new Date(row.cash_sessions.opened_at)
      : null,
    completedAt: new Date(row.completed_at),
    status: row.status,
    subtotalInCents: row.subtotal_in_cents,
    discountInCents: row.discount_in_cents,
    totalInCents: row.total_in_cents,
  };
}

function mapPayment(row: z.infer<typeof paymentRowSchema>): Payment {
  return row.method === "credit_card"
    ? {
        amountInCents: row.amount_in_cents,
        changeInCents: row.change_in_cents,
        installmentCount: row.installment_count,
        method: row.method,
      }
    : {
        amountInCents: row.amount_in_cents,
        changeInCents: row.change_in_cents,
        method: row.method,
      };
}
