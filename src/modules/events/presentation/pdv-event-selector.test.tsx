import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PdvEventSelector } from "./pdv-event-selector";

describe("PdvEventSelector", () => {
  it("renders the active event context for PDV", () => {
    render(
      <PdvEventSelector
        events={[
          {
            id: "event-1",
            location: "Centro de Eventos",
            name: "Evento Julho",
            startsAtLabel: "10/07/2026, 09:00",
          },
          {
            id: "event-2",
            location: null,
            name: "Evento Agosto",
            startsAtLabel: "10/08/2026, 09:00",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Evento ativo da operacao",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getByText(/Centro de Eventos/)).toBeInTheDocument();
    expect(screen.queryByText("Evento Agosto")).not.toBeInTheDocument();
  });
});
