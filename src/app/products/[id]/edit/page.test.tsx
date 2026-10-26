import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Money } from "@/modules/products/domain/money";

import EditProductPage from "./page";

const getProductByIdUseCaseMock = vi.hoisted(() => vi.fn());
const authorizationMock = vi.hoisted(() => vi.fn());
const listMovementsMock = vi.hoisted(() => vi.fn());
vi.mock("@/modules/auth/application/require-admin-use-case", () => ({
  requireAdminUseCase: authorizationMock,
}));
vi.mock(
  "@/modules/auth/infra/supabase-current-user-profile-repository",
  () => ({ SupabaseCurrentUserProfileRepository: vi.fn() }),
);
vi.mock("@/modules/stock/infra/supabase-stock-movement-repository", () => ({
  SupabaseStockMovementRepository: class {
    listByProductId = listMovementsMock;
  },
}));
vi.mock("@/modules/stock/presentation/adjust-stock-action", () => ({
  adjustStockAction: vi.fn(),
}));
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
  beforeEach(() => {
    authorizationMock.mockResolvedValue({ success: true });
    listMovementsMock.mockResolvedValue([
      { quantityChange: 5 },
      { quantityChange: -2 },
    ]);
  });
  it("shows read-only stock for operators", async () => {
    authorizationMock.mockResolvedValue({ success: false });
    getProductByIdUseCaseMock.mockResolvedValueOnce({
      success: true,
      product: {
        id: "product-2",
        isActive: true,
        name: "Cal?a",
        price: Money.fromReais(35),
        sku: "CAL-002",
      },
    });
    render(
      await EditProductPage({ params: Promise.resolve({ id: "product-2" }) }),
    );
    expect(
      screen.getByRole("status", { name: "Estoque atual" }),
    ).toHaveTextContent("3 unidades");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade")).not.toBeInTheDocument();
    expect(listMovementsMock).toHaveBeenCalledWith("product-2");
  });
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
      screen.getByRole("status", { name: "Estoque atual" }),
    ).toHaveTextContent("3 unidades");
    expect(
      screen.getByRole("radio", { name: /Adicionar/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Remover/ })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(listMovementsMock).toHaveBeenCalledWith("product-1");
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
