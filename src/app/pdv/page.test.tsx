import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import PdvPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/events/infra/supabase-event-repository", () => ({
  SupabaseEventRepository: vi.fn(),
}));

const listActiveEventsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/events/application/list-active-events-use-case", () => ({
  listActiveEventsUseCase: listActiveEventsUseCaseMock,
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

    render(await PdvPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "PDV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar ao painel" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByLabelText(/Evento Julho/)).toBeChecked();
  });

  it("renders an empty state when no active events exist", async () => {
    listActiveEventsUseCaseMock.mockResolvedValueOnce({
      events: [],
      success: true,
    });

    render(await PdvPage());

    expect(
      screen.getByText("Nenhum evento ativo disponivel para venda."),
    ).toBeInTheDocument();
  });
});
