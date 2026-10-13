import type { Payment, SaleItem } from "../domain/sale";
import type { SaleSummary } from "./sale-summary-repository";

export type SaleDetail = SaleSummary & {
  items: SaleItem[];
  payment: Payment;
};

export type GetSaleDetailResult =
  | {
      sale: SaleDetail;
      success: true;
    }
  | {
      error: "not_found" | "unknown";
      success: false;
    };

export type SaleDetailRepository = {
  findById(id: string): Promise<GetSaleDetailResult>;
};
