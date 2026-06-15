import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CloseCashPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
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

vi.mock(
  "@/modules/cash/infra/supabase-cash-session-closing-summary-repository",
  () => ({
    SupabaseCashSessionClosingSummaryRepository: vi.fn(),
  }),
);

vi.mock("@/modules/events/infra/supabase-event-repository", () => ({
  SupabaseEventRepository: vi.fn(),
}));

vi.mock("@/modules/cash/presentation/close-cash-session-action", () => ({
  closeCashSessionAction: vi.fn(),
}));

vi.mock("@/modules/cash/presentation/close-cash-session-form", () => ({
  CloseCashSessionForm: () => <form aria-label="Formulario de fechamento" />,
}));

const listOpenCashSessionsUseCaseMock = vi.hoisted(() => vi.fn());
const listCashSessionClosingSummariesUseCaseMock = vi.hoisted(() => vi.fn());
const listEventsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/cash/application/list-open-cash-sessions-use-case", () => ({
  listOpenCashSessionsUseCase: listOpenCashSessionsUseCaseMock,
}));

vi.mock(
  "@/modules/cash/application/list-cash-session-closing-summaries-use-case",
  () => ({
    listCashSessionClosingSummariesUseCase:
      listCashSessionClosingSummariesUseCaseMock,
  }),
);

vi.mock("@/modules/events/application/list-events-use-case", () => ({
  listEventsUseCase: listEventsUseCaseMock,
}));

describe("CloseCashPage", () => {
  it("renders the cash closing page when open sessions exist", async () => {
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
    listEventsUseCaseMock.mockResolvedValueOnce({
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
    listCashSessionClosingSummariesUseCaseMock.mockResolvedValueOnce({
      summaries: [
        {
          canceledSalesCount: 1,
          canceledSalesTotalInReais: 15,
          cashSessionId: "cash-session-1",
          completedSalesCount: 2,
          completedSalesTotalInReais: 100,
          expectedAmountInReais: 250.5,
          openingAmountInReais: 150.5,
        },
      ],
      success: true,
    });

    render(await CloseCashPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Fechar caixa" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Abrir caixa" })).toHaveAttribute(
      "href",
      "/cash/open",
    );
    expect(
      screen.getByLabelText("Formulario de fechamento"),
    ).toBeInTheDocument();
  });

  it("renders the empty state when no open sessions exist", async () => {
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      sessions: [],
      success: true,
    });
    listEventsUseCaseMock.mockResolvedValueOnce({
      events: [],
      success: true,
    });
    listCashSessionClosingSummariesUseCaseMock.mockResolvedValueOnce({
      summaries: [],
      success: true,
    });

    render(await CloseCashPage());

    expect(
      screen.getByText("Nenhum caixa aberto disponivel para fechamento."),
    ).toBeInTheDocument();
  });

  it("renders loading errors", async () => {
    listOpenCashSessionsUseCaseMock.mockResolvedValueOnce({
      formError: "Nao foi possivel carregar os caixas abertos.",
      success: false,
    });
    listEventsUseCaseMock.mockResolvedValueOnce({
      events: [],
      success: true,
    });

    render(await CloseCashPage());

    expect(
      screen.getByText("Nao foi possivel carregar os caixas abertos."),
    ).toBeInTheDocument();
  });
});
