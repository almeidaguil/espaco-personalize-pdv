import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OpenCashPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/events/infra/supabase-event-repository", () => ({
  SupabaseEventRepository: vi.fn(),
}));

vi.mock("@/modules/cash/presentation/open-cash-session-action", () => ({
  openCashSessionAction: vi.fn(),
}));

vi.mock("@/modules/cash/presentation/open-cash-session-form", () => ({
  OpenCashSessionForm: () => <form aria-label="Formulario de abertura" />,
}));

const listActiveEventsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/events/application/list-active-events-use-case", () => ({
  listActiveEventsUseCase: listActiveEventsUseCaseMock,
}));

describe("OpenCashPage", () => {
  it("renders the cash opening page when active events exist", async () => {
    listActiveEventsUseCaseMock.mockResolvedValueOnce({
      events: [
        {
          id: "event-1",
          isActive: true,
          name: "Evento Julho",
          startsAt: new Date("2026-07-10T12:00:00.000Z"),
        },
      ],
      success: true,
    });

    render(await OpenCashPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Abrir caixa" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "PDV" })).toHaveAttribute(
      "href",
      "/pdv",
    );
    expect(screen.getByLabelText("Formulario de abertura")).toBeInTheDocument();
  });

  it("renders the empty state when no active events exist", async () => {
    listActiveEventsUseCaseMock.mockResolvedValueOnce({
      events: [],
      success: true,
    });

    render(await OpenCashPage());

    expect(
      screen.getByText(
        "Nenhum evento ativo disponivel para abertura de caixa.",
      ),
    ).toBeInTheDocument();
  });
});
