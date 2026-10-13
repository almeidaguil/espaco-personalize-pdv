export type OpenCashSessionOverview = {
  id: string;
  openedAt: Date;
  openingAmountInReais: number;
  operatorId: string;
  operatorName: string;
};

export type ListOpenCashSessionOverviewsResult =
  | {
      overviews: OpenCashSessionOverview[];
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type OpenCashSessionOverviewRepository = {
  listOpen(): Promise<ListOpenCashSessionOverviewsResult>;
};
