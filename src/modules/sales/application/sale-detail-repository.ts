import type { PaymentMethod } from "@/shared/types/payment-method";

import type { SaleItem } from "../domain/sale";
import type { SaleSummary } from "./sale-summary-repository";

type LegacySaleDetailPayment = {
  amountInCents: number;
  changeInCents: number;
  method: PaymentMethod;
};

export type SaleDetail = SaleSummary & {
  items: SaleItem[];
  payment: LegacySaleDetailPayment;
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
