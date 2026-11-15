import { beforeEach, expect, it, vi } from "vitest";
import { Money } from "../domain/money";
import { updateProductAction } from "./update-product-action";
const mocks = vi.hoisted(() => ({ update: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("../infra/supabase-product-repository", () => ({
  SupabaseProductRepository: class {
    update = mocks.update;
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockImplementation(async (product) => ({
    success: true,
    product,
  }));
});
it.each(["  Algodão\nManga curta  ", "", "   "])(
  "updates and revalidates description %s",
  async (description) => {
    const form = new FormData();
    form.set("description", description);
    form.set("name", "Camisa");
    form.set("priceInReais", "35,00");
    form.set("sku", "cam-1");
    const result = await updateProductAction("product-1", {}, form);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
      id: "product-1",
      description: description.trim() || null,
      name: "Camisa",
      price: Money.fromReais(35),
      sku: "CAM-1",
      isActive: true,
    });
    expect(result.successMessage).toBe("Produto atualizado com sucesso.");
    expect(result.values?.description).toBe(description.trim());
    expect(mocks.revalidate.mock.calls).toEqual([
      ["/products"],
      ["/products/product-1/edit"],
      ["/pdv"],
      ["/stock"],
    ]);
  },
);
it("preserves description on validation failure without persistence or revalidation", async () => {
  const form = new FormData();
  form.set("description", "  Preserve me  ");
  const result = await updateProductAction("product-1", {}, form);
  expect(result.values?.description).toBe("  Preserve me  ");
  expect(result.fieldErrors?.name).toBeDefined();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("preserves description when the repository rejects an update", async () => {
  mocks.update.mockResolvedValue({ success: false, error: "not_found" });
  const form = new FormData();
  form.set("name", "Camisa");
  form.set("priceInReais", "35");
  form.set("description", "Preserve me");
  const result = await updateProductAction("missing", {}, form);
  expect(result.formError).toBe("Produto nao encontrado.");
  expect(result.values?.description).toBe("Preserve me");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
