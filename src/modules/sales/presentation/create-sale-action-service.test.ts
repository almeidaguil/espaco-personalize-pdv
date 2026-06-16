import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";
import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  ListOpenCashSessionsResult,
  SaveCashSessionResult,
} from "@/modules/cash/application/cash-session-repository";
import type { CashSession } from "@/modules/cash/domain/cash-session";
import type {
  FindProductByIdResult,
  ListProductsResult,
  ProductRepository,
  SaveProductResult,
  UpdateProductResult,
} from "@/modules/products/application/product-repository";
import { Money } from "@/modules/products/domain/money";
import type { Product } from "@/modules/products/domain/product";
import type {
  SaveStockMovementResult,
  StockMovementRepository,
} from "@/modules/stock/application/stock-movement-repository";
import type { StockMovement } from "@/modules/stock/domain/stock-movement";

import type {
  SaleRepository,
  SaveSaleResult,
} from "../application/sale-repository";
import type { Sale } from "../domain/sale";
import { createSaleActionService } from "./create-sale-action-service";

class FakeCashSessionRepository implements CashSessionRepository {
  async findOpenByIdAndOperator(): Promise<FindOpenCashSessionResult> {
    return {
      session: createCashSession(),
      success: true,
    };
  }

  async findOpenByEventAndOperator(): Promise<FindOpenCashSessionResult> {
    return {
      session: null,
      success: true,
    };
  }

  async listOpenByOperator(): Promise<ListOpenCashSessionsResult> {
    return {
      sessions: [],
      success: true,
    };
  }

  async save(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }

  async update(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }
}

class FakeProductRepository implements ProductRepository {
  async findById(): Promise<FindProductByIdResult> {
    return {
      error: "not_found",
      success: false,
    };
  }

  async list(): Promise<ListProductsResult> {
    return {
      products: [createProduct()],
      success: true,
    };
  }

  async save(product: Product): Promise<SaveProductResult> {
    return {
      product,
      success: true,
    };
  }

  async update(product: Product): Promise<UpdateProductResult> {
    return {
      product,
      success: true,
    };
  }
}

class FakeStockMovementRepository implements StockMovementRepository {
  async listAll(): Promise<StockMovement[]> {
    return [];
  }

  async listByProductId(): Promise<StockMovement[]> {
    return [createStockMovement()];
  }

  async save(movement: StockMovement): Promise<SaveStockMovementResult> {
    return {
      movement,
      success: true,
    };
  }
}

class FakeSaleRepository implements SaleRepository {
  public savedSale?: Sale;

  async save(sale: Sale): Promise<SaveSaleResult> {
    this.savedSale = sale;

    return {
      sale,
      success: true,
    };
  }
}

describe("createSaleActionService", () => {
  it("creates a sale from form data", async () => {
    const saleRepository = new FakeSaleRepository();
    const result = await createSaleActionService({}, createFormData(), {
      cashSessionRepository: new FakeCashSessionRepository(),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository,
      stockMovementRepository: new FakeStockMovementRepository(),
    });

    expect(result).toEqual({
      successMessage: "Venda finalizada com sucesso.",
    });
    expect(saleRepository.savedSale).toMatchObject({
      id: "sale-1",
      items: [
        {
          productId: "product-1",
          quantity: 2,
          totalInReais: 30,
          unitPriceInReais: 15,
        },
      ],
      payment: {
        amountInReais: 50,
        changeInReais: 20,
      },
    });
  });

  it("creates a pix sale with exact payment and zero change", async () => {
    const saleRepository = new FakeSaleRepository();
    const formData = createFormData();
    formData.set("paymentMethod", "pix");
    formData.set("amountReceivedInReais", "30,00");

    const result = await createSaleActionService({}, formData, {
      cashSessionRepository: new FakeCashSessionRepository(),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository,
      stockMovementRepository: new FakeStockMovementRepository(),
    });

    expect(result).toEqual({
      successMessage: "Venda finalizada com sucesso.",
    });
    expect(saleRepository.savedSale?.payment).toEqual({
      amountInReais: 30,
      changeInReais: 0,
      method: "pix",
    });
  });

  it("returns validation errors from invalid form data", async () => {
    const result = await createSaleActionService({}, new FormData(), {
      cashSessionRepository: new FakeCashSessionRepository(),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
      generateSaleId: () => "sale-1",
      getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      productRepository: new FakeProductRepository(),
      saleRepository: new FakeSaleRepository(),
      stockMovementRepository: new FakeStockMovementRepository(),
    });

    expect(result).toEqual({
      fieldErrors: {
        cashSessionId: "Informe o caixa.",
        eventId: "Informe o evento.",
        items: "Adicione pelo menos um item.",
        payment: "Invalid input: expected number, received NaN",
      },
      formError: undefined,
    });
  });
});

function createCurrentUserProfileRepository(): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: {
        id: "operator-1",
        role: "operator",
      },
      success: true,
    }),
  };
}

function createCashSession(): CashSession {
  return {
    eventId: "event-1",
    id: "cash-session-1",
    openedAt: new Date("2026-07-10T09:00:00.000Z"),
    openingAmountInReais: 100,
    operatorId: "operator-1",
    status: "open",
  };
}

function createProduct(): Product {
  return {
    id: "product-1",
    isActive: true,
    name: "Chaveiro Polvo",
    price: Money.fromReais(15),
    sku: "CHAVEIRO-001",
  };
}

function createStockMovement(): StockMovement {
  return {
    createdAt: new Date("2026-07-10T09:00:00.000Z"),
    id: "stock-movement-1",
    productId: "product-1",
    quantityChange: 3,
    type: "manual_adjustment",
  };
}

function createFormData(): FormData {
  const formData = new FormData();
  formData.set("cashSessionId", "cash-session-1");
  formData.set("eventId", "event-1");
  formData.set(
    "itemsJson",
    JSON.stringify([
      {
        productId: "product-1",
        quantity: 2,
      },
    ]),
  );
  formData.set("amountReceivedInReais", "50,00");
  formData.set("paymentMethod", "cash");

  return formData;
}
