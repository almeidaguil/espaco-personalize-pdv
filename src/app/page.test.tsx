import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

const getCurrentUserProfileMock = vi.hoisted(() => vi.fn());
const listOpenCashSessionOverviewsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock(
  "@/modules/auth/infra/supabase-current-user-profile-repository",
  () => ({
    SupabaseCurrentUserProfileRepository: class {
      async getCurrent() {
        return getCurrentUserProfileMock();
      }
    },
  }),
);

vi.mock(
  "@/modules/cash/infra/supabase-open-cash-session-overview-repository",
  () => ({
    SupabaseOpenCashSessionOverviewRepository: vi.fn(),
  }),
);

vi.mock(
  "@/modules/cash/application/list-open-cash-session-overviews-use-case",
  () => ({
    listOpenCashSessionOverviewsUseCase:
      listOpenCashSessionOverviewsUseCaseMock,
  }),
);

describe("Home", () => {
  it("shows an operator their open cash with sell and close actions", async () => {
    mockDashboardData("operator", [createOverview()]);

    render(await Home());

    expect(screen.getByText("Meu caixa")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Caixa aberto" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir ao PDV" })).toHaveAttribute(
      "href",
      "/pdv",
    );
    expect(
      screen
        .getAllByRole("link", { name: "Fechar caixa" })
        .some((link) => link.getAttribute("href") === "/cash/close"),
    ).toBe(true);
    expect(screen.queryByText("Caixas abertos")).not.toBeInTheDocument();
  });

  it("guides an operator without an open cash to open one", async () => {
    mockDashboardData("operator", []);

    render(await Home());

    expect(
      screen.getByRole("heading", { name: "Caixa fechado" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Abrir caixa" })
        .some((link) => link.getAttribute("href") === "/cash/open"),
    ).toBe(true);
  });

  it("shows an admin their cash and all RLS-visible open cash sessions", async () => {
    mockDashboardData("admin", [
      createOverview(),
      createOverview({
        id: "cash-session-2",
        operatorId: "operator-2",
        operatorName: "Bruno Lima",
      }),
    ]);

    render(await Home());

    expect(screen.getByText("Meu caixa")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Caixa aberto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Caixas abertos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bruno Lima")).toBeInTheDocument();
  });

  it("does not render event operational content, queries, or links", async () => {
    mockDashboardData("operator", []);

    render(await Home());

    expect(screen.queryByText("Operação do dia")).not.toBeInTheDocument();
    expect(screen.queryByText("Evento ativo")).not.toBeInTheDocument();
    const myCashPanel = screen.getByText("Meu caixa").closest("section");

    expect(myCashPanel).not.toBeNull();
    expect(
      within(myCashPanel as HTMLElement).queryByRole("link", {
        name: /Evento/,
      }),
    ).not.toBeInTheDocument();
  });
});

function mockDashboardData(
  role: "admin" | "operator",
  overviews: ReturnType<typeof createOverview>[],
) {
  getCurrentUserProfileMock.mockResolvedValueOnce({
    profile: { id: "operator-1", role },
    success: true,
  });
  listOpenCashSessionOverviewsUseCaseMock.mockResolvedValueOnce({
    overviews,
    success: true,
  });
}

function createOverview(
  overrides: Partial<{
    id: string;
    openedAt: Date;
    openingAmountInReais: number;
    operatorId: string;
    operatorName: string;
  }> = {},
) {
  return {
    id: "cash-session-1",
    openedAt: new Date("2026-10-03T09:00:00.000Z"),
    openingAmountInReais: 100,
    operatorId: "operator-1",
    operatorName: "Ana Souza",
    ...overrides,
  };
}
