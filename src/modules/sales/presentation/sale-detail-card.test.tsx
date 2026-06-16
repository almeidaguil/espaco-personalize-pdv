import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SaleDetailCard } from "./sale-detail-card";

describe("SaleDetailCard", () => {
  it("renders sale details", () => {
    render(
      <SaleDetailCard
        sale={{
          cashSessionId: "cash-session-1",
          completedAt: new Date("2026-07-10T12:00:00.000Z"),
          eventId: "event-1",
          eventName: "Evento Julho",
          id: "sale-1",
          items: [
            {
              productId: "product-1",
              productName: "Chaveiro Polvo",
              quantity: 2,
              totalInReais: 30,
              unitPriceInReais: 15,
            },
          ],
          payment: {
            amountInReais: 50,
            changeInReais: 20,
            method: "cash",
          },
          status: "completed",
          totalInReais: 30,
        }}
      />,
    );

    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 30,00")).toHaveLength(2);
    expect(screen.getByText("Chaveiro Polvo")).toBeInTheDocument();
    expect(screen.getByText("2 x R$ 15,00")).toBeInTheDocument();
    expect(screen.getByText("Dinheiro")).toBeInTheDocument();
    expect(screen.getByText("Troco")).toBeInTheDocument();
    expect(screen.getByText("R$ 20,00")).toBeInTheDocument();
  });
});
