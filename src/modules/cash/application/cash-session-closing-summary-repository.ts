export type CashSessionClosingSummary = {
  canceledSalesCount: number;
  canceledSalesTotalInReais: number;
  cashSessionId: string;
  completedSalesCount: number;
  completedSalesTotalInReais: number;
  expectedAmountInReais: number;
  openingAmountInReais: number;
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
