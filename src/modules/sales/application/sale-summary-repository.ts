import type { SaleStatus } from "../domain/sale";

export type SaleSummary = {
  cashSessionId: string;
  completedAt: Date;
  businessDate: string | null;
  cashSessionOpenedAt: Date | null;
  operatorId: string;
  operatorName: string;
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
