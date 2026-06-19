import type {
  ListSaleSummariesResult,
  SaleSummaryRepository,
} from "./sale-summary-repository";

type ListSalesUseCaseDependencies = {
  saleSummaryRepository: SaleSummaryRepository;
};

export async function listSalesUseCase({
  saleSummaryRepository,
}: ListSalesUseCaseDependencies): Promise<ListSaleSummariesResult> {
  return saleSummaryRepository.list();
}
