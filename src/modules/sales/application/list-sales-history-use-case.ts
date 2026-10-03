import { z } from "zod";
import type { SalesHistoryRepository } from "./sales-history-repository";

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional(),
  );
const filtersSchema = z
  .object({
    startDate: optional(z.iso.date("Informe uma data inicial válida.")),
    endDate: optional(z.iso.date("Informe uma data final válida.")),
    operatorId: optional(z.uuid("Selecione um operador válido.")),
    cashSessionId: optional(z.uuid("Selecione uma sessão válida.")),
    status: optional(z.enum(["completed", "canceled"])),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(8),
  })
  .refine(
    (filters) =>
      !filters.startDate ||
      !filters.endDate ||
      filters.startDate <= filters.endDate,
    {
      message: "A data final deve ser igual ou posterior à data inicial.",
      path: ["endDate"],
    },
  );

export async function listSalesHistoryUseCase({
  filters,
  salesHistoryRepository,
}: {
  filters: unknown;
  salesHistoryRepository: SalesHistoryRepository;
}) {
  const parsed = filtersSchema.safeParse(filters);
  if (!parsed.success)
    return {
      success: false as const,
      error: "invalid_filters" as const,
      formError: parsed.error.issues[0]?.message ?? "Informe filtros válidos.",
    };
  const [pageResult, optionsResult] = await Promise.all([
    salesHistoryRepository.listPage(parsed.data),
    salesHistoryRepository.listFilterOptions(parsed.data),
  ]);
  if (!pageResult.success) return pageResult;
  if (!optionsResult.success) return optionsResult;
  return {
    ...pageResult,
    filters: parsed.data,
    options: optionsResult.options,
  };
}
