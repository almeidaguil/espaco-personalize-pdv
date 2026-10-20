import type { CashSessionStatus } from "@/modules/cash/domain/cash-session";
import type {
  InstallmentCount,
  PaymentMethod,
} from "@/shared/types/payment-method";

export type SalesReportFilters = {
  cashSessionId?: string;
  endDate: string;
  exportMode?: boolean;
  itemsPage?: number;
  operatorId?: string;
  pageSize?: number;
  sessionsPage?: number;
  startDate: string;
};

export type SalesReportPaymentSummaryItem = {
  method: PaymentMethod;
  netTotalInCents: number;
  salesCount: number;
};

export type SalesReportCreditInstallmentSummaryItem = {
  installmentCount: InstallmentCount;
  netTotalInCents: number;
  salesCount: number;
};

export type SalesReportCashSessionReconciliation = {
  countedAmountInCents: number;
  differenceAmountInCents: number;
  expectedAmountInCents: number;
  method: PaymentMethod;
};

export type SalesReportProductItem = {
  grossTotalInCents: number;
  productId: string;
  productName: string;
  quantity: number;
};

export type SalesReportOperatorOption = {
  id: string;
  name: string;
};

export type SalesReportCashSessionOption = {
  businessDate: string;
  id: string;
  openedAt: string;
  operatorId: string;
  operatorName: string;
  status: CashSessionStatus;
};

export type SalesReportCashSession = SalesReportCashSessionOption & {
  canceledSalesCount: number;
  canceledTotalInCents: number;
  closedAt: string | null;
  completedDiscountInCents: number;
  completedSalesCount: number;
  completedSubtotalInCents: number;
  completedTotalInCents: number;
  countedAmountInCents: number | null;
  differenceAmountInCents: number | null;
  expectedAmountInCents: number | null;
  openingAmountInCents: number;
  reconciliations: SalesReportCashSessionReconciliation[];
};

export type SalesReport = {
  canceledSalesCount: number;
  canceledTotalInCents: number;
  cashDifferenceTotalInCents: number;
  cashShortageTotalInCents: number;
  cashSessionOptions: SalesReportCashSessionOption[];
  cashSurplusTotalInCents: number;
  completedDiscountInCents: number;
  completedSalesCount: number;
  completedSubtotalInCents: number;
  completedTotalInCents: number;
  creditInstallmentSummary: SalesReportCreditInstallmentSummaryItem[];
  endDate: string;
  items: SalesReportProductItem[];
  itemsPage: number;
  itemsTotalCount: number;
  netRevenueInCents: number;
  operatorOptions: SalesReportOperatorOption[];
  pageSize: number;
  paymentSummary: SalesReportPaymentSummaryItem[];
  postCloseAdjustmentPaymentSummary: SalesReportPaymentSummaryItem[];
  postCloseAdjustmentsCount: number;
  postCloseAdjustmentsTotalInCents: number;
  reconciliationDifferenceTotalInCents: number;
  reconciliationShortageTotalInCents: number;
  reconciliationSurplusTotalInCents: number;
  selectedCashSessionId: string | null;
  selectedOperatorId: string | null;
  sessions: SalesReportCashSession[];
  sessionsPage: number;
  sessionsTotalCount: number;
  startDate: string;
};

export type GetSalesReportResult =
  | {
      report: SalesReport;
      success: true;
    }
  | {
      error: "forbidden" | "unauthorized" | "unknown";
      success: false;
    };

export type SalesReportRepository = {
  get(filters: SalesReportFilters): Promise<GetSalesReportResult>;
};
