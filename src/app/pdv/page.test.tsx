import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PdvPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("@/shared/components/app-navigation", () => ({
  AppNavigation: () => null,
}));
vi.mock(
  "@/modules/auth/infra/supabase-current-user-profile-repository",
  () => ({
    SupabaseCurrentUserProfileRepository: vi.fn(),
  }),
);
vi.mock("@/modules/cash/infra/supabase-cash-session-repository", () => ({
  SupabaseCashSessionRepository: vi.fn(),
}));
vi.mock("@/modules/products/infra/supabase-product-repository", () => ({
  SupabaseProductRepository: vi.fn(),
}));
vi.mock("@/modules/stock/infra/supabase-stock-movement-repository", () => ({
  SupabaseStockMovementRepository: class {
    async listAll() {
      return [];
    }
  },
}));
vi.mock("@/modules/sales/presentation/pdv-cart", () => ({
  PdvCart: () => <section aria-label="Carrinho do PDV" />,
}));

const listOpenCashSessionsUseCaseMock = vi.hoisted(() => vi.fn());
const listProductsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/cash/application/list-open-cash-sessions-use-case", () => ({
  listOpenCashSessionsUseCase: listOpenCashSessionsUseCaseMock,
}));
vi.mock("@/modules/products/application/list-products-use-case", () => ({
  listProductsUseCase: listProductsUseCaseMock,
}));

describe("PdvPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the cart only when the current operator has an open cash session", async () => {
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      sessions: [
        {
          id: "cash-session-12345678",
          openedAt: new Date("2026-07-10T12:00:00.000Z"),
          openingAmountInReais: 150.5,
          operatorId: "operator-1",
          status: "open",
        },
      ],
      success: true,
    });
    listProductsUseCaseMock.mockResolvedValueOnce({
      products: [
        {
          id: "product-1",
          isActive: true,
          name: "Chaveiro Polvo",
          price: { toReais: () => 15 },
        },
      ],
      success: true,
    });

    render(await PdvPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "PDV" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Carrinho do PDV")).toBeInTheDocument();
    expect(screen.getByText("Sessao #cash-ses")).toBeInTheDocument();
  });

  it("blocks the PDV without loading products when there is no open cash session", async () => {
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      sessions: [],
      success: true,
    });

    render(await PdvPage());

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Abra o caixa antes de vender",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir caixa" })).toHaveAttribute(
      "href",
      "/cash/open",
    );
    expect(screen.queryByLabelText("Carrinho do PDV")).not.toBeInTheDocument();
    expect(listProductsUseCaseMock).not.toHaveBeenCalled();
  });
});
