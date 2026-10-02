import { z } from "zod";

import type {
  GetSalesReportResult,
  SalesReportFilters,
  SalesReportRepository,
} from "./sales-report-repository";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine(isCalendarDate, "Informe uma data válida.");

const optionalUuidSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.uuid("Informe um identificador válido.").optional(),
);

const salesReportFiltersSchema = z
  .object({
    cashSessionId: optionalUuidSchema,
    endDate: dateSchema,
    exportMode: z.boolean().default(false),
    itemsPage: z.coerce.number().int().positive().default(1),
    operatorId: optionalUuidSchema,
    pageSize: z.coerce.number().int().min(1).max(10_000).default(8),
    sessionsPage: z.coerce.number().int().positive().default(1),
    startDate: dateSchema,
  })
  .superRefine((filters, context) => {
    if (!filters.exportMode && filters.pageSize > 200) {
      context.addIssue({
        code: "custom",
        message: "A página do relatório não pode exceder 200 registros.",
        path: ["pageSize"],
      });
    }

    const startTime = Date.parse(`${filters.startDate}T00:00:00.000Z`);
    const endTime = Date.parse(`${filters.endDate}T00:00:00.000Z`);

    if (endTime < startTime) {
      context.addIssue({
        code: "custom",
        message: "A data final deve ser igual ou posterior à data inicial.",
        path: ["endDate"],
      });
      return;
    }

    const inclusiveDays = (endTime - startTime) / 86_400_000 + 1;

    if (inclusiveDays > 366) {
      context.addIssue({
        code: "custom",
        message: "O período máximo permitido é de 366 dias.",
        path: ["endDate"],
      });
    }
  });

type GetSalesReportUseCaseInput = {
  filters: SalesReportFilters;
  salesReportRepository: SalesReportRepository;
};

export type GetSalesReportUseCaseResult =
  | GetSalesReportResult
  | {
      formError: string;
      success: false;
    };

export async function getSalesReportUseCase({
  filters,
  salesReportRepository,
}: GetSalesReportUseCaseInput): Promise<GetSalesReportUseCaseResult> {
  const parsedFilters = salesReportFiltersSchema.safeParse(filters);

  if (!parsedFilters.success) {
    return {
      formError:
        parsedFilters.error.issues[0]?.message ??
        "Informe filtros válidos para gerar o relatório.",
      success: false,
    };
  }

  return salesReportRepository.get(parsedFilters.data);
}

function isCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
