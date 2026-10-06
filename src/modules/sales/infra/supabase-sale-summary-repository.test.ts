import { describe, expect, it } from "vitest";
import { SupabaseSaleSummaryRepository } from "./supabase-sale-summary-repository";
import { createSalesReadClient, saleRow } from "../testing/sales-read-client";

describe("SupabaseSaleSummaryRepository", () => {
  it("reads sales linked to operator cash sessions and resolves operator names", async () => {
    const client = createSalesReadClient({
      sales: [
        saleRow(),
        saleRow({ id: "sale-2", cash_session_id: "cash-session-2" }),
      ],
    });
    const result = await new SupabaseSaleSummaryRepository(client).list();
    expect(result).toMatchObject({
      success: true,
      sales: [
        {
          id: "sale-1",
          operatorId: "operator-1",
          operatorName: "Ana",
          cashSessionId: "cash-session-1",
          businessDate: "2026-07-10",
          totalInReais: 30,
        },
        { id: "sale-2", operatorName: "Ana", cashSessionId: "cash-session-2" },
      ],
    });
  });
  it("keeps dashboard totals complete beyond one database page", async () => {
    const client = createSalesReadClient({
      sales: Array.from({ length: 501 }, (_, index) =>
        saleRow({ id: `sale-${index}` }),
      ),
    });
    const result = await new SupabaseSaleSummaryRepository(client).list();
    expect(result.success && result.sales).toHaveLength(501);
    expect(client.calls.filter(([method]) => method === "range")).toHaveLength(
      2,
    );
  });
  it("preserves identity when profile and cash metadata are unavailable", async () => {
    const client = createSalesReadClient({
      sales: [saleRow({ cash_sessions: null })],
      profiles: [],
    });
    expect(
      await new SupabaseSaleSummaryRepository(client).list(),
    ).toMatchObject({
      success: true,
      sales: [
        {
          operatorName: "Operador operator",
          operatorId: "operator-1",
          cashSessionId: "cash-session-1",
          businessDate: null,
        },
      ],
    });
  });
  it("filters and paginates history on the server with stable ordering", async () => {
    const client = createSalesReadClient({ sales: [saleRow()], count: 17 });
    const result = await new SupabaseSaleSummaryRepository(client).listPage({
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      operatorId: "operator-1",
      cashSessionId: "cash-session-1",
      status: "canceled",
      page: 2,
      pageSize: 8,
    });
    expect(result).toMatchObject({
      success: true,
      page: 2,
      pageSize: 8,
      totalCount: 17,
    });
    expect(client.calls).toEqual(
      expect.arrayContaining([
        ["gte", "cash_sessions.business_date", "2026-07-01"],
        ["lte", "cash_sessions.business_date", "2026-07-31"],
        ["eq", "operator_id", "operator-1"],
        ["eq", "cash_session_id", "cash-session-1"],
        ["eq", "status", "canceled"],
        ["order", "completed_at", { ascending: false }],
        ["order", "id", { ascending: false }],
        ["range", 8, 15],
      ]),
    );
    expect(
      client.calls.some(
        ([method, value]) =>
          method === "select" && String(value).includes("cash_sessions!inner"),
      ),
    ).toBe(true);
  });
  it("maps errors", async () => {
    const client = createSalesReadClient({ error: { message: "offline" } });
    expect(await new SupabaseSaleSummaryRepository(client).list()).toEqual({
      success: false,
      error: "unknown",
    });
  });
  it("offers all permitted operators and narrows sessions by operator, including historical cash sessions", async () => {
    const client = createSalesReadClient({
      sessions: [
        {
          id: "cash-1",
          operator_id: "operator-1",
          business_date: "2026-07-10",
          opened_at: "2026-07-10T11:00:00Z",
        },
        {
          id: "cash-2",
          operator_id: "operator-2",
          business_date: "2026-07-10",
          opened_at: "2026-07-10T13:00:00Z",
        },
        {
          id: "cash-3",
          operator_id: "operator-1",
          business_date: "2026-07-10",
          opened_at: "2026-07-10T15:00:00Z",
        },
      ],
    });
    const result = await new SupabaseSaleSummaryRepository(
      client,
    ).listFilterOptions({
      page: 1,
      pageSize: 8,
      startDate: "2026-07-10",
      operatorId: "operator-1",
    });
    expect(result).toMatchObject({
      success: true,
      options: {
        operators: [
          { id: "operator-1", name: "Ana" },
          { id: "operator-2", name: "Operador operator" },
        ],
        sessions: [{ id: "cash-1" }, { id: "cash-3" }],
      },
    });
    expect(client.calls).toContainEqual(["gte", "business_date", "2026-07-10"]);
    expect(
      client.calls.some(
        ([method, field]) => method === "eq" && field === "status",
      ),
    ).toBe(false);
  });
  it("does not silently truncate the session selector", async () => {
    const client = createSalesReadClient({
      sessions: Array.from({ length: 501 }, (_, index) => ({
        id: `cash-${index}`,
        operator_id: "operator-1",
        business_date: "2026-07-10",
        opened_at: "2026-07-10T11:00:00Z",
      })),
    });
    const result = await new SupabaseSaleSummaryRepository(
      client,
    ).listFilterOptions({ page: 1, pageSize: 8 });
    expect(result.success && result.options.sessions).toHaveLength(501);
  });
  it("rejects malformed sale data", async () => {
    const client = createSalesReadClient({
      sales: [saleRow({ total_in_cents: "not-a-number" })],
    });
    expect(await new SupabaseSaleSummaryRepository(client).list()).toEqual({
      success: false,
      error: "unknown",
    });
  });
});
