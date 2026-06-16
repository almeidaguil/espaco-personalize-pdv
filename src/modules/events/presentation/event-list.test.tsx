import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventList } from "./event-list";

describe("EventList", () => {
  it("renders event summary cards", () => {
    render(
      <EventList
        action={vi.fn()}
        events={[
          {
            id: "event-1",
            isActive: true,
            location: "Centro de Eventos",
            name: "Evento Julho",
            periodLabel: "10/07/2026, 09:00 - 10/07/2026, 18:00",
          },
          {
            id: "event-2",
            isActive: false,
            location: null,
            name: "Evento Agosto",
            periodLabel: "10/08/2026, 09:00",
          },
        ]}
      />,
    );

    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getByText("Centro de Eventos")).toBeInTheDocument();
    expect(
      screen.getByText("10/07/2026, 09:00 - 10/07/2026, 18:00"),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento Agosto")).toBeInTheDocument();
    expect(screen.getByText("Sem local")).toBeInTheDocument();
    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalizar evento" }),
    ).toBeInTheDocument();
  });
});
