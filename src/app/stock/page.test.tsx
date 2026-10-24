import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Money } from "@/modules/products/domain/money";

import StockPage from "./page";

const authorizationMock = vi.hoisted(() =>
  vi.fn(async () => ({ success: true })),
);
vi.mock("@/modules/auth/application/require-admin-use-case", () => ({
  requireAdminUseCase: authorizationMock,
}));
vi.mock(
  "@/modules/auth/infra/supabase-current-user-profile-repository",
  () => ({ SupabaseCurrentUserProfileRepository: vi.fn() }),
);

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/shared/components/app-navigation", () => ({
  AppNavigation: () => null,
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
    products: {
      id: string;
      name: string;
      sku?: string;
      quantityOnHand: number;
    }[];
  }) => (
    <form aria-label="Formulario de ajuste de estoque">
      {products.map((product) => (
        <span key={product.id}>
          {product.sku ? `${product.name} — ${product.sku}` : product.name}
          <span>Estoque atual: {product.quantityOnHand}</span>
        </span>
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
  it("hides adjustment controls from operators", async () => {
    authorizationMock.mockResolvedValueOnce({ success: false });
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
      screen.queryByLabelText("Formulario de ajuste de estoque"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Cadastrar produto" }),
    ).not.toBeInTheDocument();
  });
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
      screen.getByRole("heading", {
        level: 1,
        name: "Controle de estoque",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Formulario de ajuste de estoque"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Caneca personalizada — CANECA-001"),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Caneca personalizada (CANECA-001)").length,
    ).toBeGreaterThanOrEqual(1);

    expect(screen.getByLabelText("Resumo de estoque")).toBeInTheDocument();
    expect(screen.getByText("Estoque atual: 7")).toBeInTheDocument();

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
      screen.getByText(
        "Cadastre ou ative um produto antes de ajustar o estoque.",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Cadastrar produto",
      }),
    ).toHaveAttribute("href", "/products/new");
  });
});
