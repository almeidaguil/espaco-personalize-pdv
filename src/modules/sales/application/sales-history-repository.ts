import type { SaleStatus } from "../domain/sale";
import type { SaleSummary } from "./sale-summary-repository";

export type SalesHistoryFilters = {
  startDate?: string;
  endDate?: string;
  operatorId?: string;
  cashSessionId?: string;
  status?: SaleStatus;
  page: number;
  pageSize: number;
};

export type SalesHistoryOptions = {
  operators: { id: string; name: string }[];
  sessions: {
    id: string;
    operatorId: string;
    operatorName: string;
    businessDate: string;
    openedAt: Date;
  }[];
};

export type SalesHistoryPage = {
  sales: SaleSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type ListSalesHistoryResult =
  | (SalesHistoryPage & { success: true })
  | { success: false; error: "unknown" };

export type SalesHistoryRepository = {
  listPage(filters: SalesHistoryFilters): Promise<ListSalesHistoryResult>;
  listFilterOptions(
    filters: SalesHistoryFilters,
  ): Promise<
    | { success: true; options: SalesHistoryOptions }
    | { success: false; error: "unknown" }
  >;
};
