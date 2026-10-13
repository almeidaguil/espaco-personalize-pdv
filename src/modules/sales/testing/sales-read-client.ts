type Row = Record<string, unknown>;
export function saleRow(overrides: Row = {}) {
  return {
    id: "sale-1",
    cash_session_id: "cash-session-1",
    operator_id: "operator-1",
    completed_at: "2026-07-10T12:00:00.000Z",
    status: "completed",
    total_in_cents: 3000,
    cash_sessions: {
      business_date: "2026-07-10",
      opened_at: "2026-07-10T11:00:00.000Z",
    },
    sale_items: [
      {
        product_id: "product-1",
        product_name: "Camiseta",
        quantity: 2,
        unit_price_in_cents: 1500,
        total_in_cents: 3000,
      },
    ],
    payments: [
      { method: "cash", amount_in_cents: 5000, change_in_cents: 2000 },
    ],
    ...overrides,
  };
}
export function createSalesReadClient(
  options: {
    sales?: Row[];
    profiles?: Row[];
    sessions?: Row[];
    count?: number;
    error?: { message: string };
  } = {},
) {
  const calls: unknown[][] = [];
  const tables: Record<string, Row[]> = {
    sales: options.sales ?? [saleRow()],
    profiles: options.profiles ?? [{ id: "operator-1", full_name: "Ana" }],
    cash_sessions: options.sessions ?? [],
  };
  return {
    calls,
    from(table: string) {
      calls.push(["from", table]);
      let rows = tables[table] ?? [];
      const builder = {
        select(columns: string, config?: unknown) {
          calls.push(["select", columns, config]);
          return builder;
        },
        eq(column: string, value: string) {
          calls.push(["eq", column, value]);
          return builder;
        },
        gte(column: string, value: string) {
          calls.push(["gte", column, value]);
          return builder;
        },
        lte(column: string, value: string) {
          calls.push(["lte", column, value]);
          return builder;
        },
        in(column: string, values: string[]) {
          calls.push(["in", column, values]);
          return builder;
        },
        order(column: string, config: unknown) {
          calls.push(["order", column, config]);
          return builder;
        },
        range(start: number, end: number) {
          calls.push(["range", start, end]);
          rows = rows.slice(start, end + 1);
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({
            data: rows[0] ?? null,
            error: options.error ?? null,
          });
        },
        then<
          TResult1 = {
            data: Row[];
            error: { message: string } | null;
            count: number;
          },
          TResult2 = never,
        >(
          resolve?:
            | ((value: {
                data: Row[];
                error: { message: string } | null;
                count: number;
              }) => TResult1 | PromiseLike<TResult1>)
            | null,
          reject?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve({
            data: rows,
            error: options.error ?? null,
            count: options.count ?? tables[table].length,
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}
