import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StockMovementsOverview } from "./stock-movements-overview";

describe("StockMovementsOverview", () => {
  it("renders balances and movement history", () => {
    render(
      <StockMovementsOverview
        balances={[
          {
            productId: "product-1",
            productLabel: "Caneca personalizada",
            quantityOnHand: 7,
          },
        ]}
        movements={[
          {
            createdAt: new Date("2026-06-10T12:00:00.000Z"),
            id: "movement-1",
            productId: "product-1",
            productLabel: "Caneca personalizada",
            quantityChange: -3,
            type: "manual_adjustment",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Estoque atual" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Movimentacoes" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Caneca personalizada")).toHaveLength(2);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("-3")).toBeInTheDocument();
    expect(screen.getByText("Ajuste manual")).toBeInTheDocument();
  });

  it("renders empty states", () => {
    render(<StockMovementsOverview balances={[]} movements={[]} />);

    expect(
      screen.getByText("Nenhum produto com saldo registrado ainda."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma movimentacao registrada ainda."),
    ).toBeInTheDocument();
  });
});
