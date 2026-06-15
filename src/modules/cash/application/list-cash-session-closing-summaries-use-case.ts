import type { CashSessionClosingSummaryRepository } from "./cash-session-closing-summary-repository";

export async function listCashSessionClosingSummariesUseCase(input: {
  cashSessionIds: string[];
  cashSessionClosingSummaryRepository: CashSessionClosingSummaryRepository;
}) {
  if (input.cashSessionIds.length === 0) {
    return {
      summaries: [],
      success: true as const,
    };
  }

  return input.cashSessionClosingSummaryRepository.listByCashSessionIds(
    input.cashSessionIds,
  );
}
