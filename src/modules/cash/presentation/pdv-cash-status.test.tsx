import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PdvCashStatus } from "./pdv-cash-status";

describe("PdvCashStatus", () => {
  it("renders the cash opening requirement when there are no open sessions", () => {
    render(<PdvCashStatus sessions={[]} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Abra o caixa antes de vender",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir caixa" })).toHaveAttribute(
      "href",
      "/cash/open",
    );
  });

  it("renders open cash sessions available for sales", () => {
    render(
      <PdvCashStatus
        sessions={[
          {
            eventName: "Evento Julho",
            id: "cash-session-1",
            openedAtLabel: "10/07/2026, 09:00",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Caixa aberto para venda",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getByText("Aberto em 10/07/2026, 09:00")).toBeInTheDocument();
  });
});
