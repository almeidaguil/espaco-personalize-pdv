import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Money } from "@/modules/products/domain/money";

import StockPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/products/infra/supabase-product-repository", () => ({
  SupabaseProductRepository: vi.fn(),
}));

vi.mock("@/modules/stock/infra/supabase-stock-movement-repository", () => ({
  SupabaseStockMovementRepository: vi.fn(),
}));

vi.mock("@/modules/stock/presentation/adjust-stock-action", () => ({
  adjustStockAction: vi.fn(),
}));

vi.mock("@/modules/stock/presentation/stock-adjustment-form", () => ({
  StockAdjustmentForm: ({
    products,
  }: {
    products: { id: string; label: string }[];
  }) => (
    <form aria-label="Formulario de ajuste de estoque">
      {products.map((product) => (
        <span key={product.id}>{product.label}</span>
      ))}
    </form>
  ),
}));

vi.mock("@/modules/stock/presentation/stock-movements-overview", () => ({
  StockMovementsOverview: ({
    balances,
    movements,
  }: {
    balances: { productId: string; productLabel: string }[];
    movements: { id: string; productLabel: string }[];
  }) => (
    <section aria-label="Resumo de estoque">
      {balances.map((balance) => (
        <span key={balance.productId}>{balance.productLabel}</span>
      ))}
      {movements.map((movement) => (
        <span key={movement.id}>{movement.productLabel}</span>
      ))}
    </section>
  ),
}));

const listProductsUseCaseMock = vi.hoisted(() => vi.fn());
const listStockMovementsSummaryUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/products/application/list-products-use-case", () => ({
  listProductsUseCase: listProductsUseCaseMock,
}));

vi.mock(
  "@/modules/stock/application/list-stock-movements-summary-use-case",
  () => ({
    listStockMovementsSummaryUseCase: listStockMovementsSummaryUseCaseMock,
  }),
);

describe("StockPage", () => {
  it("renders stock adjustment form with active products", async () => {
    listProductsUseCaseMock.mockResolvedValueOnce({
      products: [
        {
          id: "product-1",
          isActive: true,
          name: "Caneca personalizada",
          price: Money.fromReais(35),
          sku: "CANECA-001",
        },
        {
          id: "product-2",
          isActive: false,
          name: "Produto inativo",
          price: Money.fromReais(10),
        },
      ],
      success: true,
    });
    listStockMovementsSummaryUseCaseMock.mockResolvedValueOnce({
      balances: [
        {
          productId: "product-1",
          productLabel: "Caneca personalizada (CANECA-001)",
          quantityOnHand: 7,
        },
      ],
      movements: [
        {
          id: "movement-1",
          productLabel: "Caneca personalizada (CANECA-001)",
        },
      ],
      success: true,
    });

    render(await StockPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Estoque" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Formulario de ajuste de estoque"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Caneca personalizada (CANECA-001)").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("Resumo de estoque")).toBeInTheDocument();
    expect(screen.queryByText("Produto inativo")).not.toBeInTheDocument();
  });

  it("renders empty product guidance", async () => {
    listProductsUseCaseMock.mockResolvedValueOnce({
      products: [],
      success: true,
    });
    listStockMovementsSummaryUseCaseMock.mockResolvedValueOnce({
      balances: [],
      movements: [],
      success: true,
    });

    render(await StockPage());

    expect(
      screen.getByText(/Cadastre ou ative um produto/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo produto" })).toHaveAttribute(
      "href",
      "/products/new",
    );
  });
});
