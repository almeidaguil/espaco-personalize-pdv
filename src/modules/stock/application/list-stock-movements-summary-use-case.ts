import type { ProductRepository } from "@/modules/products/application/product-repository";
import type { Product } from "@/modules/products/domain/product";

import { calculateStockBalance } from "../domain/stock-balance";
import type {
  StockMovement,
  StockMovementType,
} from "../domain/stock-movement";
import type { StockMovementRepository } from "./stock-movement-repository";

export type StockMovementSummaryItem = {
  createdAt: Date;
  id: string;
  productId: string;
  productLabel: string;
  quantityChange: number;
  type: StockMovementType;
};

export type StockProductBalanceSummary = {
  productId: string;
  productLabel: string;
  quantityOnHand: number;
};

export type ListStockMovementsSummaryResult =
  | {
      balances: StockProductBalanceSummary[];
      movements: StockMovementSummaryItem[];
      success: true;
    }
  | {
      formError: string;
      success: false;
    };

type ListStockMovementsSummaryDependencies = {
  productRepository: ProductRepository;
  stockMovementRepository: StockMovementRepository;
};

export async function listStockMovementsSummaryUseCase({
  productRepository,
  stockMovementRepository,
}: ListStockMovementsSummaryDependencies): Promise<ListStockMovementsSummaryResult> {
  const productResult = await productRepository.list();

  if (!productResult.success) {
    return {
      formError: "Nao foi possivel carregar os produtos.",
      success: false,
    };
  }

  const productsById = new Map(
    productResult.products.map((product) => [product.id, product]),
  );
  const movements = await stockMovementRepository.listAll();

  return {
    balances: buildBalanceSummaries(productResult.products, movements),
    movements: movements.map((movement) =>
      toStockMovementSummaryItem(movement, productsById),
    ),
    success: true,
  };
}

function buildBalanceSummaries(
  products: Product[],
  movements: StockMovement[],
): StockProductBalanceSummary[] {
  return products
    .map((product) => {
      const productMovements = movements.filter(
        (movement) => movement.productId === product.id,
      );

      return {
        productId: product.id,
        productLabel: toProductLabel(product),
        quantityOnHand: calculateStockBalance(productMovements),
      };
    })
    .filter((summary) => summary.quantityOnHand !== 0)
    .sort((first, second) =>
      first.productLabel.localeCompare(second.productLabel, "pt-BR"),
    );
}

function toStockMovementSummaryItem(
  movement: StockMovement,
  productsById: Map<string, Product>,
): StockMovementSummaryItem {
  const product = productsById.get(movement.productId);

  return {
    createdAt: movement.createdAt,
    id: movement.id,
    productId: movement.productId,
    productLabel: product ? toProductLabel(product) : "Produto removido",
    quantityChange: movement.quantityChange,
    type: movement.type,
  };
}

function toProductLabel(product: Product): string {
  return product.sku ? `${product.name} (${product.sku})` : product.name;
}
