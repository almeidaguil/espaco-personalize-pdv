import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CloseCashPage from "./page";

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

vi.mock(
  "@/modules/cash/infra/supabase-open-cash-session-overview-repository",
  () => ({
    SupabaseOpenCashSessionOverviewRepository: vi.fn(),
  }),
);

vi.mock(
  "@/modules/cash/infra/supabase-cash-session-closing-summary-repository",
  () => ({
    SupabaseCashSessionClosingSummaryRepository: vi.fn(),
  }),
);

vi.mock("@/modules/cash/presentation/close-cash-session-action", () => ({
  closeCashSessionAction: vi.fn(),
}));

vi.mock("@/modules/cash/presentation/close-cash-session-form", () => ({
  CloseCashSessionForm: ({ sessions }: { sessions: { label: string }[] }) => (
    <form aria-label="Formulário de fechamento">
      {sessions.map((session) => (
        <span key={session.label}>{session.label}</span>
      ))}
    </form>
  ),
}));

const listOpenCashSessionOverviewsUseCaseMock = vi.hoisted(() => vi.fn());

const listCashSessionClosingSummariesUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/modules/cash/application/list-open-cash-session-overviews-use-case",
  () => ({
    listOpenCashSessionOverviewsUseCase:
      listOpenCashSessionOverviewsUseCaseMock,
  }),
);

vi.mock(
  "@/modules/cash/application/list-cash-session-closing-summaries-use-case",
  () => ({
    listCashSessionClosingSummariesUseCase:
      listCashSessionClosingSummariesUseCaseMock,
  }),
);

describe("CloseCashPage", () => {
  it("renders the cash closing page when open sessions exist", async () => {
    listOpenCashSessionOverviewsUseCaseMock.mockResolvedValueOnce({
      overviews: [
        {
          id: "cash-session-1",
          openedAt: new Date("2026-07-10T12:00:00.000Z"),
          openingAmountInReais: 150.5,
          operatorId: "operator-1",
          operatorName: "Ana Souza",
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
      screen.getByRole("heading", {
        level: 1,
        name: "Fechar caixa",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Voltar para o PDV",
      }),
    ).toHaveAttribute("href", "/pdv");

    expect(
      screen.getByLabelText("Formulário de fechamento"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Ana Souza · aberto em 10/07/2026, 09:00 · sessão cash-session-1",
      ),
    ).toBeInTheDocument();
  });

  it("renders the empty state when no open sessions exist", async () => {
    listOpenCashSessionOverviewsUseCaseMock.mockResolvedValueOnce({
      overviews: [],
      success: true,
    });

    listCashSessionClosingSummariesUseCaseMock.mockResolvedValueOnce({
      summaries: [],
      success: true,
    });

    render(await CloseCashPage());

    expect(
      screen.getByText("Nenhum caixa aberto disponível para fechamento."),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Abrir caixa",
      }),
    ).toHaveAttribute("href", "/cash/open");

    expect(
      screen.getByRole("link", {
        name: "Ir ao PDV",
      }),
    ).toHaveAttribute("href", "/pdv");
  });

  it("renders loading errors", async () => {
    listOpenCashSessionOverviewsUseCaseMock.mockResolvedValueOnce({
      formError: "Não foi possível carregar os caixas abertos.",
      success: false,
    });

    render(await CloseCashPage());

    expect(
      screen.getByText("Não foi possível carregar os caixas abertos."),
    ).toBeInTheDocument();
  });
});
