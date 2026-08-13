import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
          {
            createdAt: new Date("2026-06-10T13:00:00.000Z"),
            id: "movement-2",
            productId: "product-1",
            productLabel: "Caneca personalizada",
            quantityChange: -1,
            type: "sale",
          },
          {
            createdAt: new Date("2026-06-10T14:00:00.000Z"),
            id: "movement-3",
            productId: "product-1",
            productLabel: "Caneca personalizada",
            quantityChange: 1,
            type: "sale_cancellation",
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
    expect(screen.getAllByText("Caneca personalizada")).toHaveLength(4);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("-3")).toBeInTheDocument();
    expect(screen.getAllByText("Ajuste manual").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getAllByText("Venda").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Cancelamento de venda").length,
    ).toBeGreaterThanOrEqual(1);
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

  it("paginates balances and movement history independently", async () => {
    const user = userEvent.setup();
    const balances = Array.from({ length: 9 }, (_, index) => ({
      productId: `product-${index + 1}`,
      productLabel: `Produto ${index + 1}`,
      quantityOnHand: index + 1,
    }));
    const movements = Array.from({ length: 9 }, (_, index) => ({
      createdAt: new Date("2026-06-10T12:00:00.000Z"),
      id: `movement-${index + 1}`,
      productId: `product-${index + 1}`,
      productLabel: `Movimento Produto ${index + 1}`,
      quantityChange: index + 1,
      type: "manual_adjustment" as const,
    }));

    render(
      <StockMovementsOverview balances={balances} movements={movements} />,
    );

    expect(screen.getByText("Produto 8")).toBeInTheDocument();
    expect(screen.queryByText("Produto 9")).not.toBeInTheDocument();
    expect(screen.getByText("Movimento Produto 8")).toBeInTheDocument();
    expect(screen.queryByText("Movimento Produto 9")).not.toBeInTheDocument();

    const nextButtons = screen.getAllByRole("button", { name: "Proxima" });
    await user.click(nextButtons[0]!);

    expect(screen.getByText("Produto 9")).toBeInTheDocument();
    expect(screen.queryByText("Movimento Produto 9")).not.toBeInTheDocument();

    await user.click(nextButtons[1]!);

    expect(screen.getByText("Movimento Produto 9")).toBeInTheDocument();
    expect(
      screen.getByText("Mostrando 9-9 de 9 movimentacoes"),
    ).toBeInTheDocument();
  });

  it("filters balances by product label", async () => {
    const user = userEvent.setup();

    render(
      <StockMovementsOverview
        balances={[
          {
            productId: "product-1",
            productLabel: "Caneca personalizada (CANECA-001)",
            quantityOnHand: 7,
          },
          {
            productId: "product-2",
            productLabel: "Chaveiro polvo (CHAVEIRO-001)",
            quantityOnHand: 3,
          },
        ]}
        movements={[]}
      />,
    );

    await user.type(screen.getByLabelText("Buscar produto"), "cane");

    expect(
      screen.getByText("Caneca personalizada (CANECA-001)"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Chaveiro polvo (CHAVEIRO-001)"),
    ).not.toBeInTheDocument();
  });

  it("filters movement history by type", async () => {
    const user = userEvent.setup();

    render(
      <StockMovementsOverview
        balances={[]}
        movements={[
          {
            createdAt: new Date("2026-06-10T12:00:00.000Z"),
            id: "movement-1",
            productId: "product-1",
            productLabel: "Caneca personalizada",
            quantityChange: -1,
            type: "sale",
          },
          {
            createdAt: new Date("2026-06-10T13:00:00.000Z"),
            id: "movement-2",
            productId: "product-2",
            productLabel: "Chaveiro polvo",
            quantityChange: 5,
            type: "manual_adjustment",
          },
        ]}
      />,
    );

    await user.selectOptions(
      screen.getByLabelText("Tipo de movimentacao"),
      "sale",
    );

    expect(screen.getByText("Caneca personalizada")).toBeInTheDocument();
    expect(screen.queryByText("Chaveiro polvo")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
