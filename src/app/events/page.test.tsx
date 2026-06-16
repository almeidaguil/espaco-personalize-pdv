import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EventsPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/events/infra/supabase-event-repository", () => ({
  SupabaseEventRepository: vi.fn(),
}));

vi.mock("@/modules/events/presentation/close-event-action", () => ({
  closeEventAction: vi.fn(),
}));

const listEventsUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/events/application/list-events-use-case", () => ({
  listEventsUseCase: listEventsUseCaseMock,
}));

describe("EventsPage", () => {
  it("renders events returned by the use case", async () => {
    listEventsUseCaseMock.mockResolvedValueOnce({
      events: [
        {
          endsAt: new Date("2026-07-10T21:00:00.000Z"),
          id: "event-1",
          isActive: true,
          location: "Centro de Eventos",
          name: "Evento Julho",
          startsAt: new Date("2026-07-10T12:00:00.000Z"),
        },
      ],
      success: true,
    });

    render(await EventsPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Eventos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar ao painel" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Novo evento" })).toHaveAttribute(
      "href",
      "/events/new",
    );
    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getByText("Centro de Eventos")).toBeInTheDocument();
  });

  it("renders the empty state when no events exist", async () => {
    listEventsUseCaseMock.mockResolvedValueOnce({
      events: [],
      success: true,
    });

    render(await EventsPage());

    expect(
      screen.getByText("Nenhum evento cadastrado ainda."),
    ).toBeInTheDocument();
  });
});
