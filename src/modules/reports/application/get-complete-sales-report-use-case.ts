import { getSalesReportUseCase } from "./get-sales-report-use-case";
import type {
  SalesReportFilters,
  SalesReportRepository,
} from "./sales-report-repository";

const exportRowLimit = 10_000;

type GetCompleteSalesReportUseCaseInput = {
  filters: SalesReportFilters;
  salesReportRepository: SalesReportRepository;
};

export async function getCompleteSalesReportUseCase({
  filters,
  salesReportRepository,
}: GetCompleteSalesReportUseCaseInput) {
  const result = await getSalesReportUseCase({
    filters: {
      ...filters,
      exportMode: true,
      itemsPage: 1,
      pageSize: exportRowLimit,
      sessionsPage: 1,
    },
    salesReportRepository,
  });

  if (!result.success || "formError" in result) {
    return result;
  }

  if (
    result.report.items.length !== result.report.itemsTotalCount ||
    result.report.sessions.length !== result.report.sessionsTotalCount
  ) {
    return { error: "unknown" as const, success: false as const };
  }

  return result;
}
