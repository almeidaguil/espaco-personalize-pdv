import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Money } from "@/modules/products/domain/money";

import EditProductPage from "./page";

const getProductByIdUseCaseMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/products/infra/supabase-product-repository", () => ({
  SupabaseProductRepository: vi.fn(),
}));

vi.mock("@/modules/products/application/get-product-by-id-use-case", () => ({
  getProductByIdUseCase: getProductByIdUseCaseMock,
}));

vi.mock("@/modules/products/presentation/update-product-action", () => ({
  updateProductAction: vi.fn(),
}));

vi.mock("@/modules/products/presentation/product-form", () => ({
  ProductForm: () => <form aria-label="Formulario de edicao de produto" />,
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

describe("EditProductPage", () => {
  it("renders the edit page with the product form", async () => {
    getProductByIdUseCaseMock.mockResolvedValueOnce({
      product: {
        id: "product-1",
        isActive: true,
        name: "Caneca personalizada",
        price: Money.fromReais(35),
        sku: "CANECA-001",
      },
      success: true,
    });

    render(
      await EditProductPage({
        params: Promise.resolve({ id: "product-1" }),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Editar produto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Produtos" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(
      screen.getByLabelText("Formulario de edicao de produto"),
    ).toBeInTheDocument();
  });

  it("delegates to notFound when the product does not exist", async () => {
    getProductByIdUseCaseMock.mockResolvedValueOnce({
      error: "not_found",
      success: false,
    });

    await EditProductPage({
      params: Promise.resolve({ id: "missing-product" }),
    });

    expect(notFoundMock).toHaveBeenCalled();
  });
});
