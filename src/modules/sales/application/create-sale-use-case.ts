import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import type { CashSessionRepository } from "@/modules/cash/application/cash-session-repository";
import type { ProductRepository } from "@/modules/products/application/product-repository";
import type { Product } from "@/modules/products/domain/product";
import { calculateStockBalance } from "@/modules/stock/domain/stock-balance";
import type { StockMovementRepository } from "@/modules/stock/application/stock-movement-repository";

import {
  createSale,
  type CreateSaleItemInput,
  type Sale,
} from "../domain/sale";
import type { SaleRepository } from "./sale-repository";
import { createSaleSchema } from "./sale-validation";

export type SaleIdGenerator = () => string;
export type SaleDateProvider = () => Date;

export type CreateSaleUseCaseResult =
  | {
      sale: Sale;
      success: true;
    }
  | {
      fieldErrors?: Partial<
        Record<"cashSessionId" | "eventId" | "items" | "payment", string>
      >;
      formError?: string;
      success: false;
    };

type CreateSaleUseCaseDependencies = {
  cashSessionRepository: CashSessionRepository;
  currentUserProfileRepository: CurrentUserProfileRepository;
  generateSaleId: SaleIdGenerator;
  getCurrentDate: SaleDateProvider;
  productRepository: ProductRepository;
  saleRepository: SaleRepository;
  stockMovementRepository: StockMovementRepository;
};

export async function createSaleUseCase(
  input: unknown,
  dependencies: CreateSaleUseCaseDependencies,
): Promise<CreateSaleUseCaseResult> {
  const currentProfileResult =
    await dependencies.currentUserProfileRepository.getCurrent();

  if (!currentProfileResult.success) {
    return {
      formError:
        currentProfileResult.error === "unauthenticated"
          ? "Sessao expirada. Entre novamente."
          : "Nao foi possivel identificar o usuario atual.",
      success: false,
    };
  }

  const parsedInput = createSaleSchema.safeParse(input);

  if (!parsedInput.success) {
    const flattenedErrors = parsedInput.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        cashSessionId: flattenedErrors.cashSessionId?.[0],
        eventId: flattenedErrors.eventId?.[0],
        items: flattenedErrors.items?.[0],
        payment: flattenedErrors.payment?.[0],
      },
      success: false,
    };
  }

  const openCashSessionResult =
    await dependencies.cashSessionRepository.findOpenByIdAndOperator({
      cashSessionId: parsedInput.data.cashSessionId,
      operatorId: currentProfileResult.profile.id,
    });

  if (!openCashSessionResult.success) {
    return {
      formError: "Nao foi possivel verificar o caixa aberto.",
      success: false,
    };
  }

  if (!openCashSessionResult.session) {
    return {
      formError: "Nao ha caixa aberto para esta venda.",
      success: false,
    };
  }

  if (openCashSessionResult.session.eventId !== parsedInput.data.eventId) {
    return {
      formError: "O caixa aberto nao pertence ao evento informado.",
      success: false,
    };
  }

  const productsResult = await dependencies.productRepository.list();

  if (!productsResult.success) {
    return {
      formError: "Nao foi possivel carregar os produtos.",
      success: false,
    };
  }

  const productsById = new Map(
    productsResult.products.map((product) => [product.id, product]),
  );
  const mergedItems = mergeSaleItems(parsedInput.data.items);
  const saleItems: CreateSaleItemInput[] = [];

  for (const item of mergedItems) {
    const product = productsById.get(item.productId);

    if (!product || !product.isActive) {
      return {
        formError: "Produto indisponivel para venda.",
        success: false,
      };
    }

    const stockMovements =
      await dependencies.stockMovementRepository.listByProductId(
        item.productId,
      );
    const quantityOnHand = calculateStockBalance(stockMovements);

    if (quantityOnHand < item.quantity) {
      return {
        formError: `Estoque insuficiente para ${toProductLabel(product)}.`,
        success: false,
      };
    }

    saleItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPriceInReais: product.price.toReais(),
    });
  }

  const saleResult = createSale({
    cashSessionId: parsedInput.data.cashSessionId,
    completedAt: dependencies.getCurrentDate(),
    eventId: parsedInput.data.eventId,
    id: dependencies.generateSaleId(),
    items: saleItems,
    payment: parsedInput.data.payment,
  });

  if (!saleResult.success) {
    return {
      formError: saleResult.errors[0]?.message ?? "Venda invalida.",
      success: false,
    };
  }

  const saveResult = await dependencies.saleRepository.save(saleResult.sale);

  if (!saveResult.success) {
    return {
      formError: "Nao foi possivel registrar a venda.",
      success: false,
    };
  }

  return {
    sale: saveResult.sale,
    success: true,
  };
}

function mergeSaleItems(
  items: Array<{ productId: string; quantity: number }>,
): Array<{ productId: string; quantity: number }> {
  const quantitiesByProductId = new Map<string, number>();

  for (const item of items) {
    quantitiesByProductId.set(
      item.productId,
      (quantitiesByProductId.get(item.productId) ?? 0) + item.quantity,
    );
  }

  return [...quantitiesByProductId.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
}

function toProductLabel(product: Product): string {
  return product.sku ? `${product.name} (${product.sku})` : product.name;
}
