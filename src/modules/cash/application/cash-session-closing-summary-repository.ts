import type { PaymentMethod } from "@/shared/types/payment-method";

export type CashSessionClosingSummary = {
  canceledSalesCount: number;
  canceledSalesTotalInCents: number;
  cashSessionId: string;
  completedSalesCount: number;
  completedSalesTotalInCents: number;
  expectedByMethodInCents: Record<PaymentMethod, number>;
  openingAmountInCents: number;
};

export type ListCashSessionClosingSummariesResult =
  | {
      summaries: CashSessionClosingSummary[];
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type CashSessionClosingSummaryRepository = {
  listByCashSessionIds(
    cashSessionIds: string[],
  ): Promise<ListCashSessionClosingSummariesResult>;
};
