import { beforeEach, describe, expect, it, vi } from "vitest";
import { adjustStockAction } from "./adjust-stock-action";
const mocks = vi.hoisted(() => ({ service: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("./adjust-stock-action-service", () => ({
  adjustStockActionService: mocks.service,
}));
describe("adjustStockAction revalidation", () => {
  beforeEach(() => vi.clearAllMocks());
  it("refreshes stock and the exact edited product after persistence", async () => {
    mocks.service.mockResolvedValue({
      successMessage: "Estoque ajustado com sucesso.",
    });
    const data = new FormData();
    data.set("productId", "product-2");
    await adjustStockAction({}, data);
    expect(mocks.revalidate.mock.calls).toEqual([
      ["/stock"],
      ["/products/product-2/edit"],
    ]);
  });
  it("does not revalidate when the server rejects the adjustment", async () => {
    mocks.service.mockResolvedValue({
      formError: "Acesso restrito a administradores.",
    });
    await adjustStockAction({}, new FormData());
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
