import type {
  GetSaleDetailResult,
  SaleDetailRepository,
} from "./sale-detail-repository";

type GetSaleDetailUseCaseDependencies = {
  saleDetailRepository: SaleDetailRepository;
};

export async function getSaleDetailUseCase(
  id: string,
  { saleDetailRepository }: GetSaleDetailUseCaseDependencies,
): Promise<GetSaleDetailResult> {
  const saleId = id.trim();

  if (!saleId) {
    return {
      error: "not_found",
      success: false,
    };
  }

  return saleDetailRepository.findById(saleId);
}
