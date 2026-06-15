import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/events/infra/supabase-event-repository", () => ({
  SupabaseEventRepository: vi.fn(),
}));

vi.mock("@/modules/cash/infra/supabase-cash-session-repository", () => ({
  SupabaseCashSessionRepository: vi.fn(),
}));

vi.mock(
  "@/modules/auth/infra/supabase-current-user-profile-repository",
  () => ({
    SupabaseCurrentUserProfileRepository: vi.fn(),
  }),
);

vi.mock("@/modules/sales/infra/supabase-sale-summary-repository", () => ({
  SupabaseSaleSummaryRepository: vi.fn(),
}));

const listActiveEventsUseCaseMock = vi.hoisted(() => vi.fn());
const listOpenCashSessionsUseCaseMock = vi.hoisted(() => vi.fn());
const listSalesUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/events/application/list-active-events-use-case", () => ({
  listActiveEventsUseCase: listActiveEventsUseCaseMock,
}));

vi.mock("@/modules/cash/application/list-open-cash-sessions-use-case", () => ({
  listOpenCashSessionsUseCase: listOpenCashSessionsUseCaseMock,
}));

vi.mock("@/modules/sales/application/list-sales-use-case", () => ({
  listSalesUseCase: listSalesUseCaseMock,
}));

describe("Home", () => {
  it("renders the operational dashboard when cash is open", async () => {
    mockOperationalData();

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 1, name: "PDV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Espaco Personalize" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Operacao do dia")).toBeInTheDocument();
    expect(
      screen.getByText("Pronto para vender em Evento Julho"),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento ativo")).toBeInTheDocument();
    expect(screen.getAllByText("Evento Julho").length).toBeGreaterThan(0);
    expect(screen.getByText("Vendas do caixa")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("1 concluidas / 1 canceladas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir ao PDV" })).toHaveAttribute(
      "href",
      "/pdv",
    );
    expect(
      screen.getAllByRole("link", { name: "Fechar caixa" })[0],
    ).toHaveAttribute("href", "/cash/close");
    expect(
      screen
        .getAllByRole("link", { name: /Produtos/ })
        .some((link) => link.getAttribute("href") === "/products"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Abrir caixa/ })
        .some((link) => link.getAttribute("href") === "/cash/open"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: /Fechar caixa/ })
        .some((link) => link.getAttribute("href") === "/cash/close"),
    ).toBe(true);
    expect(screen.getAllByText("Disponivel")).toHaveLength(5);
  });

  it("guides the operator to create an event when none is active", async () => {
    listActiveEventsUseCaseMock.mockResolvedValueOnce({
      events: [],
      success: true,
    });
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      sessions: [],
      success: true,
    });
    listSalesUseCaseMock.mockResolvedValueOnce({
      sales: [],
      success: true,
    });

    render(await Home());

    expect(screen.getByText("Crie um evento para comecar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar evento" })).toHaveAttribute(
      "href",
      "/events/new",
    );
  });
});

function mockOperationalData() {
  listActiveEventsUseCaseMock.mockResolvedValueOnce({
    events: [
      {
        id: "event-1",
        isActive: true,
        name: "Evento Julho",
        startsAt: new Date("2026-07-10T09:00:00.000Z"),
      },
    ],
    success: true,
  });
  listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
    sessions: [
      {
        eventId: "event-1",
        id: "cash-session-1",
        openedAt: new Date("2026-07-10T09:00:00.000Z"),
        openingAmountInReais: 100,
        operatorId: "operator-1",
        status: "open",
      },
    ],
    success: true,
  });
  listSalesUseCaseMock.mockResolvedValueOnce({
    sales: [
      {
        cashSessionId: "cash-session-1",
        completedAt: new Date("2026-07-10T12:00:00.000Z"),
        eventId: "event-1",
        eventName: "Evento Julho",
        id: "sale-1",
        status: "completed",
        totalInReais: 30,
      },
      {
        cashSessionId: "cash-session-1",
        completedAt: new Date("2026-07-10T13:00:00.000Z"),
        eventId: "event-1",
        eventName: "Evento Julho",
        id: "sale-2",
        status: "canceled",
        totalInReais: 15,
      },
    ],
    success: true,
  });
}
