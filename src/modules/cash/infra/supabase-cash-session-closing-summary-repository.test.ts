import { describe, expect, it, vi } from "vitest";

import {
  SupabaseCashSessionClosingSummaryRepository,
  type SupabaseCashSessionClosingSummaryClient,
} from "./supabase-cash-session-closing-summary-repository";

describe("SupabaseCashSessionClosingSummaryRepository", () => {
  it("uses only the net cash payment in the expected closing amount", async () => {
    const cashSessionIn = vi.fn(async () => ({
      data: [{ id: "cash-session-1", opening_amount_in_cents: 5000 }],
      error: null,
    }));
    const salesIn = vi.fn(async () => ({
      data: [
        {
          cash_session_id: "cash-session-1",
          payments: [
            { amount_in_cents: 12000, change_in_cents: 3000, method: "cash" },
          ],
          status: "completed",
          total_in_cents: 9000,
        },
      ],
      error: null,
    }));
    const from = vi.fn((table: "cash_sessions" | "sales") => ({
      select: vi.fn(() => ({
        in: table === "cash_sessions" ? cashSessionIn : salesIn,
      })),
    })) as unknown as SupabaseCashSessionClosingSummaryClient["from"];
    const client: SupabaseCashSessionClosingSummaryClient = {
      from,
    };
    const repository = new SupabaseCashSessionClosingSummaryRepository(client);

    await expect(
      repository.listByCashSessionIds(["cash-session-1"]),
    ).resolves.toEqual({
      success: true,
      summaries: [
        {
          canceledSalesCount: 0,
          canceledSalesTotalInReais: 0,
          cashSessionId: "cash-session-1",
          completedSalesCount: 1,
          completedSalesTotalInReais: 90,
          expectedAmountInReais: 140,
          openingAmountInReais: 50,
        },
      ],
    });
  });
});
