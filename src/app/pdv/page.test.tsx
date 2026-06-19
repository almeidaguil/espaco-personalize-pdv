import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PdvPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/events/infra/supabase-event-repository", () => ({
  SupabaseEventRepository: vi.fn(),
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

const listActiveEventsUseCaseMock = vi.hoisted(() => vi.fn());
const listOpenCashSessionsUseCaseMock = vi.hoisted(() => vi.fn());
const listProductsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/events/application/list-active-events-use-case", () => ({
  listActiveEventsUseCase: listActiveEventsUseCaseMock,
}));

vi.mock("@/modules/cash/application/list-open-cash-sessions-use-case", () => ({
  listOpenCashSessionsUseCase: listOpenCashSessionsUseCaseMock,
}));

vi.mock("@/modules/products/application/list-products-use-case", () => ({
  listProductsUseCase: listProductsUseCaseMock,
}));

describe("PdvPage", () => {
  it("renders active events for selection", async () => {
    listActiveEventsUseCaseMock.mockResolvedValueOnce({
      events: [
        {
          id: "event-1",
          isActive: true,
          location: "Centro de Eventos",
          name: "Evento Julho",
          startsAt: new Date("2026-07-10T12:00:00.000Z"),
        },
      ],
      success: true,
    });
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      sessions: [
        {
          eventId: "event-1",
          id: "cash-session-1",
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
          price: {
            toReais: () => 15,
          },
        },
      ],
      success: true,
    });

    render(await PdvPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "PDV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar ao painel" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Caixa aberto para venda",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento ativo da operacao")).toBeInTheDocument();
    expect(screen.getAllByText("Evento Julho").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Carrinho do PDV")).toBeInTheDocument();
  });

  it("renders the cash opening requirement when there are no open sessions", async () => {
    listActiveEventsUseCaseMock.mockResolvedValueOnce({
      events: [
        {
          id: "event-1",
          isActive: true,
          location: "Centro de Eventos",
          name: "Evento Julho",
          startsAt: new Date("2026-07-10T12:00:00.000Z"),
        },
      ],
      success: true,
    });
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      sessions: [],
      success: true,
    });
    listProductsUseCaseMock.mockResolvedValueOnce({
      products: [],
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
  });

  it("renders an empty state when no active events exist", async () => {
    listActiveEventsUseCaseMock.mockResolvedValueOnce({
      events: [],
      success: true,
    });
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      sessions: [],
      success: true,
    });
    listProductsUseCaseMock.mockResolvedValueOnce({
      products: [],
      success: true,
    });

    render(await PdvPage());

    expect(
      screen.getByText("Nenhum evento ativo disponivel para venda."),
    ).toBeInTheDocument();
  });
});
