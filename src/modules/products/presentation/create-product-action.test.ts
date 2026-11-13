import { expect, it, vi } from "vitest";
import { createProductAction } from "./create-product-action";
const mocks = vi.hoisted(() => ({ service: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("./create-product-action-service", () => ({
  createProductActionService: mocks.service,
}));
it.each(["Algodão", ""])(
  "passes description %s to the service and revalidates dependent pages",
  async (description) => {
    vi.clearAllMocks();
    const form = new FormData();
    form.set("description", description);
    const state = { successMessage: "Produto cadastrado com sucesso." };
    mocks.service.mockResolvedValue(state);
    expect(await createProductAction({}, form)).toBe(state);
    expect(mocks.service).toHaveBeenCalledWith(
      form,
      expect.objectContaining({
        productRepository: expect.anything(),
        stockMovementRepository: expect.anything(),
      }),
    );
    expect(mocks.service.mock.calls[0][0].get("description")).toBe(description);
    expect(mocks.revalidate.mock.calls).toEqual([
      ["/products"],
      ["/stock"],
      ["/pdv"],
    ]);
  },
);
