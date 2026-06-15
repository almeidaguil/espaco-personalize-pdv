import type { SaleStatus } from "../domain/sale";

export type SaleSummary = {
  completedAt: Date;
  eventId: string;
  eventName: string;
  id: string;
  status: SaleStatus;
  totalInReais: number;
};

export type ListSaleSummariesResult =
  | {
      sales: SaleSummary[];
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type SaleSummaryRepository = {
  list(): Promise<ListSaleSummariesResult>;
};
