import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SalesList } from "./sales-list";

describe("SalesList", () => {
  it("renders sale summaries", () => {
    render(
      <SalesList
        sales={[
          {
            completedAt: new Date("2026-07-10T12:00:00.000Z"),
            eventId: "event-1",
            eventName: "Evento Julho",
            id: "sale-1",
            status: "completed",
            totalInReais: 30,
          },
        ]}
      />,
    );

    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByText("Concluida")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver detalhes" })).toHaveAttribute(
      "href",
      "/sales/sale-1",
    );
  });

  it("renders an empty state", () => {
    render(<SalesList sales={[]} />);

    expect(
      screen.getByText("Nenhuma venda registrada ainda."),
    ).toBeInTheDocument();
  });
});
