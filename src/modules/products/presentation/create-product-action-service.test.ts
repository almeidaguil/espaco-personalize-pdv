import { describe, expect, it, vi } from "vitest";
import type { Product } from "../domain/product";
import type { StockMovement } from "@/modules/stock/domain/stock-movement";
import type { SaveStockMovementResult } from "@/modules/stock/application/stock-movement-repository";
import type { SaveProductResult } from "../application/product-repository";
import { createProductActionService } from "./create-product-action-service";

function setup(quantity?: string, role: "admin" | "operator" = "admin") {
  const form = new FormData();
  form.set("name", "Camiseta");
  form.set("priceInReais", "35,00");
  if (quantity !== undefined) form.set("initialStockQuantity", quantity);
  const dependencies = {
    currentUserProfileRepository: {
      getCurrent: vi.fn(async () => ({
        success: true as const,
        profile: { id: "admin-1", role },
      })),
    },
    productRepository: {
      save: vi.fn(
        async (product: Product): Promise<SaveProductResult> => ({
          success: true as const,
          product,
        }),
      ),
      update: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
    },
    stockMovementRepository: {
      listAll: vi.fn(),
      listByProductId: vi.fn(async () => []),
      save: vi.fn(
        async (movement: StockMovement): Promise<SaveStockMovementResult> => ({
          success: true as const,
          movement,
        }),
      ),
    },
    generateProductId: () => "product-1",
    generateStockMovementId: () => "movement-1",
    getCurrentDate: () => new Date("2026-10-20T12:00:00Z"),
  };
  return { form, dependencies };
}

describe("createProductActionService", () => {
  it("creates a product and registers the existing initial adjustment contract", async () => {
    const { form, dependencies } = setup("12");
    const result = await createProductActionService(form, dependencies);
    expect(result.successMessage).toBe("Produto cadastrado com sucesso.");
    expect(
      dependencies.stockMovementRepository.save,
    ).toHaveBeenCalledExactlyOnceWith({
      id: "movement-1",
      productId: "product-1",
      quantityChange: 12,
      type: "initial_adjustment",
      createdAt: new Date("2026-10-20T12:00:00Z"),
    });
    expect(result.values?.name).toBe("");
  });

  it.each([undefined, "", "0"])(
    "does not create a zero movement for %s",
    async (quantity) => {
      const { form, dependencies } = setup(quantity);
      expect(
        (await createProductActionService(form, dependencies)).successMessage,
      ).toBeDefined();
      expect(dependencies.productRepository.save).toHaveBeenCalledOnce();
      expect(dependencies.stockMovementRepository.save).not.toHaveBeenCalled();
    },
  );

  it.each(["-1", "1.5", "1,5", "abc", "Infinity", "1e3", "2147483648"])(
    "rejects %s before any persistence and preserves values",
    async (quantity) => {
      const { form, dependencies } = setup(quantity);
      const result = await createProductActionService(form, dependencies);
      expect(result.fieldErrors?.initialStockQuantity).toBeDefined();
      expect(result.values?.initialStockQuantity).toBe(quantity);
      expect(dependencies.productRepository.save).not.toHaveBeenCalled();
      expect(dependencies.stockMovementRepository.save).not.toHaveBeenCalled();
    },
  );

  it("rejects operators before persistence", async () => {
    const { form, dependencies } = setup("12", "operator");
    expect(
      (await createProductActionService(form, dependencies)).formError,
    ).toBeDefined();
    expect(dependencies.productRepository.save).not.toHaveBeenCalled();
  });

  it("does not create stock when product validation fails", async () => {
    const { form, dependencies } = setup("12");
    form.set("name", "");
    expect(
      (await createProductActionService(form, dependencies)).fieldErrors?.name,
    ).toBeDefined();
    expect(dependencies.stockMovementRepository.save).not.toHaveBeenCalled();
  });

  it("reports partial persistence without inviting product resubmission", async () => {
    const { form, dependencies } = setup("12");
    dependencies.stockMovementRepository.save.mockRejectedValueOnce(
      new Error("connection lost"),
    );
    const result = await createProductActionService(form, dependencies);
    expect(result.successMessage).toBeUndefined();
    expect(result.formError).toContain("Não cadastre novamente");
    expect(result.formError).toContain("12 unidades");
    expect(result.values?.name).toBe("");
    expect(dependencies.productRepository.save).toHaveBeenCalledOnce();
  });

  it("does not create a movement after a duplicate SKU failure", async () => {
    const { form, dependencies } = setup("12");
    dependencies.productRepository.save.mockResolvedValueOnce({
      success: false,
      error: "sku_already_exists",
    });
    const result = await createProductActionService(form, dependencies);
    expect(result.formError).toContain("SKU");
    expect(result.values?.initialStockQuantity).toBe("12");
    expect(dependencies.stockMovementRepository.save).not.toHaveBeenCalled();
  });

  it("reports a rejected stock write as partial persistence", async () => {
    const { form, dependencies } = setup("12");
    dependencies.stockMovementRepository.save.mockResolvedValueOnce({
      success: false,
      error: "unknown",
    });
    const result = await createProductActionService(form, dependencies);
    expect(result.successMessage).toBeUndefined();
    expect(result.formError).toContain("Não cadastre novamente");
    expect(result.values?.name).toBe("");
  });
});
