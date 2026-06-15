export type SalesByEventProductReportItem = {
  grossTotalInReais: number;
  productId: string;
  productName: string;
  quantity: number;
};

export type SalesByEventReport = {
  canceledSalesCount: number;
  canceledTotalInReais: number;
  completedSalesCount: number;
  eventId: string;
  eventName: string;
  grossTotalInReais: number;
  items: SalesByEventProductReportItem[];
};

export type GetSalesByEventReportResult =
  | {
      report: SalesByEventReport;
      success: true;
    }
  | {
      error: "not_found" | "unknown";
      success: false;
    };

export type SalesByEventReportRepository = {
  getByEventId(eventId: string): Promise<GetSalesByEventReportResult>;
};
