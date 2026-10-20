import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SaleDetail } from "../application/sale-detail-repository";

import { SaleDetailCard } from "./sale-detail-card";

describe("SaleDetailCard", () => {
  it("renders every payment with gross, net, and cash change", () => {
    render(
      <SaleDetailCard
        sale={saleDetailFixture({
          payments: [
            {
              amountInCents: 1500,
              changeInCents: 0,
              method: "pix",
            },
            {
              amountInCents: 2000,
              changeInCents: 500,
              method: "cash",
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("operator-1")).toBeInTheDocument();
    expect(screen.getByText("cash-session-1")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 30,00")).toHaveLength(2);
    expect(screen.getByText("Subtotal").parentElement).toHaveTextContent(
      "R$ 35,00",
    );
    expect(screen.getByText("Desconto").parentElement).toHaveTextContent(
      "R$ 5,00",
    );
    expect(screen.getByText("Desconto concedido por Ana")).toBeInTheDocument();
    expect(screen.getByText("Chaveiro Polvo")).toBeInTheDocument();
    expect(screen.getByText("2 × R$ 15,00")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("Dinheiro")).toBeInTheDocument();
    expect(screen.getAllByText("Contribuição líquida")).toHaveLength(2);
    expect(screen.getByText("Troco").parentElement).toHaveTextContent(
      "R$ 5,00",
    );
  });

  it.each([
    [1, "À vista"],
    [2, "2x"],
    [3, "3x"],
  ] as const)(
    "renders credit card installment count %i as %s",
    (count, label) => {
      render(
        <SaleDetailCard
          sale={saleDetailFixture({
            payments: [
              {
                amountInCents: 3000,
                changeInCents: 0,
                installmentCount: count,
                method: "credit_card",
              },
            ],
          })}
        />,
      );

      expect(screen.getByText("Cartão de crédito")).toBeInTheDocument();
      expect(screen.getByText("Parcelamento").parentElement).toHaveTextContent(
        label,
      );
    },
  );
});

function saleDetailFixture(overrides: Partial<SaleDetail> = {}): SaleDetail {
  return {
    businessDate: "2026-07-10",
    cashSessionId: "cash-session-1",
    cashSessionOpenedAt: new Date("2026-07-10T11:00:00Z"),
    completedAt: new Date("2026-07-10T12:00:00.000Z"),
    discountInCents: 500,
    id: "sale-1",
    items: [
      {
        productId: "product-1",
        productName: "Chaveiro Polvo",
        quantity: 2,
        totalInCents: 3000,
        unitPriceInCents: 1500,
      },
    ],
    operatorId: "operator-1",
    operatorName: "Ana",
    payments: [
      {
        amountInCents: 3000,
        changeInCents: 0,
        method: "cash",
      },
    ],
    status: "completed",
    subtotalInCents: 3500,
    totalInCents: 3000,
    ...overrides,
  };
}
