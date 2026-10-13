import { z } from "zod";
import type { SaleSummary } from "../application/sale-summary-repository";

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

export const saleSummaryRowSchema = z.object({
  id: z.string(),
  cash_session_id: z.string(),
  operator_id: z.string(),
  completed_at: z.iso.datetime({ offset: true }),
  status: z.enum(["completed", "canceled"]),
  total_in_cents: z.number().int().nonnegative(),
  cash_sessions: z
    .object({
      business_date: z.iso.date(),
      opened_at: z.iso.datetime({ offset: true }),
    })
    .nullable(),
});

export function saleSummaryColumns(inner = false): string {
  return `id,cash_session_id,operator_id,status,total_in_cents,completed_at,cash_sessions${inner ? "!inner" : ""}(business_date,opened_at)`;
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
    businessDate: row.cash_sessions?.business_date ?? null,
    cashSessionOpenedAt: row.cash_sessions
      ? new Date(row.cash_sessions.opened_at)
      : null,
    completedAt: new Date(row.completed_at),
    status: row.status,
    totalInReais: row.total_in_cents / 100,
  };
}
