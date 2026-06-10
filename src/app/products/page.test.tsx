import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Money } from "@/modules/products/domain/money";

import ProductsPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/products/infra/supabase-product-repository", () => ({
  SupabaseProductRepository: vi.fn(),
}));

const listProductsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/products/application/list-products-use-case", () => ({
  listProductsUseCase: listProductsUseCaseMock,
}));

describe("ProductsPage", () => {
  it("renders products returned by the use case", async () => {
    listProductsUseCaseMock.mockResolvedValueOnce({
      products: [
        {
          id: "product-1",
          isActive: true,
          name: "Caneca personalizada",
          price: Money.fromReais(35),
          sku: "CANECA-001",
        },
      ],
      success: true,
    });

    render(await ProductsPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Produtos" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo" })).toHaveAttribute(
      "href",
      "/products/new",
    );
    expect(screen.getByText("Caneca personalizada")).toBeInTheDocument();
    expect(screen.getByText("R$ 35,00")).toBeInTheDocument();
  });

  it("renders the empty state when no products exist", async () => {
    listProductsUseCaseMock.mockResolvedValueOnce({
      products: [],
      success: true,
    });

    render(await ProductsPage());

    expect(
      screen.getByText("Nenhum produto cadastrado ainda."),
    ).toBeInTheDocument();
  });
});
