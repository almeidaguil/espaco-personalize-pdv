import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PdvEventSelector } from "./pdv-event-selector";

describe("PdvEventSelector", () => {
  it("renders active event options for PDV", () => {
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
        name: "Selecione o evento da venda",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Evento Julho/)).toBeChecked();
    expect(screen.getByLabelText(/Evento Agosto/)).not.toBeChecked();
    expect(screen.getByText(/Centro de Eventos/)).toBeInTheDocument();
    expect(screen.getByText(/Sem local/)).toBeInTheDocument();
  });
});
