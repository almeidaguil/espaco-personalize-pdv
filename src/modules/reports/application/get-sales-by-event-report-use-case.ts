import { z } from "zod";

import type {
  GetSalesByEventReportResult,
  SalesByEventReportRepository,
} from "./sales-by-event-report-repository";

const getSalesByEventReportInputSchema = z.object({
  eventId: z.uuid("Selecione um evento valido."),
});

type GetSalesByEventReportUseCaseInput = {
  eventId: string;
  salesByEventReportRepository: SalesByEventReportRepository;
};

export type GetSalesByEventReportUseCaseResult =
  | GetSalesByEventReportResult
  | {
      formError: string;
      success: false;
    };

export async function getSalesByEventReportUseCase({
  eventId,
  salesByEventReportRepository,
}: GetSalesByEventReportUseCaseInput): Promise<GetSalesByEventReportUseCaseResult> {
  const parsedInput = getSalesByEventReportInputSchema.safeParse({ eventId });

  if (!parsedInput.success) {
    return {
      formError: "Selecione um evento valido para gerar o relatorio.",
      success: false,
    };
  }

  return salesByEventReportRepository.getByEventId(parsedInput.data.eventId);
}
