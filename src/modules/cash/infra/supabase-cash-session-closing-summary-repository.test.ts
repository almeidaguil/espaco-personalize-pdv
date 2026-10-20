import { describe, expect, it, vi } from "vitest";

import {
  SupabaseCashSessionClosingSummaryRepository,
  type SupabaseCashSessionClosingSummaryClient,
} from "./supabase-cash-session-closing-summary-repository";

describe("SupabaseCashSessionClosingSummaryRepository", () => {
  it("calculates every expected method from completed split payments", async () => {
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
        {
          cash_session_id: "cash-session-1",
          payments: [
            { amount_in_cents: 11000, change_in_cents: 0, method: "pix" },
            {
              amount_in_cents: 2000,
              change_in_cents: 0,
              method: "credit_card",
            },
            { amount_in_cents: 3000, change_in_cents: 0, method: "debit_card" },
          ],
          status: "completed",
          total_in_cents: 16000,
        },
        {
          cash_session_id: "cash-session-1",
          payments: [
            { amount_in_cents: 99999, change_in_cents: 0, method: "cash" },
          ],
          status: "canceled",
          total_in_cents: 99999,
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
          canceledSalesCount: 1,
          canceledSalesTotalInCents: 99999,
          cashSessionId: "cash-session-1",
          completedSalesCount: 2,
          completedSalesTotalInCents: 25000,
          expectedByMethodInCents: {
            cash: 14000,
            credit_card: 2000,
            debit_card: 3000,
            pix: 11000,
          },
          openingAmountInCents: 5000,
        },
      ],
    });
  });
});
