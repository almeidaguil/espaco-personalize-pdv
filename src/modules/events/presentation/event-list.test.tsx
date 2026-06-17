import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("orders active events first and paginates long lists", async () => {
    const user = userEvent.setup();

    render(
      <EventList
        action={vi.fn()}
        events={[
          {
            id: "event-1",
            isActive: false,
            location: null,
            name: "Evento Antigo 1",
            periodLabel: "01/07/2026, 09:00",
          },
          {
            id: "event-2",
            isActive: true,
            location: null,
            name: "Evento Ativo",
            periodLabel: "02/07/2026, 09:00",
          },
          ...Array.from({ length: 6 }, (_, index) => ({
            id: `event-extra-${index + 1}`,
            isActive: false,
            location: null,
            name: `Evento Extra ${index + 1}`,
            periodLabel: "03/07/2026, 09:00",
          })),
        ]}
      />,
    );

    const eventNames = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(eventNames[0]).toBe("Evento Ativo");
    expect(screen.queryByText("Evento Extra 6")).not.toBeInTheDocument();
    expect(screen.getByText("Mostrando 1-6 de 8 eventos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Proxima" }));

    expect(screen.getByText("Evento Extra 6")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 7-8 de 8 eventos")).toBeInTheDocument();
  });
});
