import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SalesByEventReport } from "./sales-by-event-report";

describe("SalesByEventReport", () => {
  it("renders event filters, summary and sold items", () => {
    render(
      <SalesByEventReport
        events={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            isActive: true,
            name: "Evento Julho",
            startsAt: new Date("2026-07-10T09:00:00.000Z"),
          },
        ]}
        report={{
          canceledSalesCount: 1,
          canceledTotalInReais: 15,
          completedSalesCount: 2,
          eventId: "11111111-1111-4111-8111-111111111111",
          eventName: "Evento Julho",
          grossTotalInReais: 45,
          items: [
            {
              grossTotalInReais: 45,
              productId: "product-1",
              productName: "Chaveiro Polvo",
              quantity: 3,
            },
          ],
          paymentSummary: [
            {
              method: "cash",
              netTotalInReais: 30,
              salesCount: 1,
            },
            {
              method: "pix",
              netTotalInReais: 15,
              salesCount: 1,
            },
            {
              method: "credit_card",
              netTotalInReais: 0,
              salesCount: 0,
            },
            {
              method: "debit_card",
              netTotalInReais: 0,
              salesCount: 0,
            },
          ],
        }}
        selectedEventId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByLabelText("Evento")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 45,00")).toHaveLength(2);
    expect(screen.getByText("Resumo por pagamento")).toBeInTheDocument();
    expect(screen.getByText("Dinheiro")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00 (1)")).toBeInTheDocument();
    expect(screen.getByText("Pix")).toBeInTheDocument();
    expect(screen.getByText("R$ 15,00 (1)")).toBeInTheDocument();
    expect(screen.getByText("Chaveiro Polvo")).toBeInTheDocument();
    expect(screen.getByText("3 unidade(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute(
      "href",
      "/reports/export?eventId=11111111-1111-4111-8111-111111111111",
    );
  });

  it("renders the empty event state", () => {
    render(<SalesByEventReport events={[]} report={null} selectedEventId="" />);

    expect(
      screen.getByText("Cadastre um evento para gerar relatorios de vendas."),
    ).toBeInTheDocument();
  });

  it("paginates sold items", async () => {
    const user = userEvent.setup();

    render(
      <SalesByEventReport
        events={[
          {
            id: "11111111-1111-4111-8111-111111111111",
            isActive: true,
            name: "Evento Julho",
            startsAt: new Date("2026-07-10T09:00:00.000Z"),
          },
        ]}
        report={{
          canceledSalesCount: 0,
          canceledTotalInReais: 0,
          completedSalesCount: 9,
          eventId: "11111111-1111-4111-8111-111111111111",
          eventName: "Evento Julho",
          grossTotalInReais: 90,
          items: Array.from({ length: 9 }, (_, index) => ({
            grossTotalInReais: index + 1,
            productId: `product-${index + 1}`,
            productName: `Produto ${index + 1}`,
            quantity: index + 1,
          })),
          paymentSummary: [
            {
              method: "cash",
              netTotalInReais: 90,
              salesCount: 9,
            },
            {
              method: "pix",
              netTotalInReais: 0,
              salesCount: 0,
            },
            {
              method: "credit_card",
              netTotalInReais: 0,
              salesCount: 0,
            },
            {
              method: "debit_card",
              netTotalInReais: 0,
              salesCount: 0,
            },
          ],
        }}
        selectedEventId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(screen.getByText("Mostrando 1-8 de 9 itens")).toBeInTheDocument();
    expect(screen.getByText("Produto 1")).toBeInTheDocument();
    expect(screen.queryByText("Produto 9")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Proxima" }));

    expect(screen.getByText("Mostrando 9-9 de 9 itens")).toBeInTheDocument();
    expect(screen.getByText("Produto 9")).toBeInTheDocument();
    expect(screen.queryByText("Produto 1")).not.toBeInTheDocument();
  });
});
