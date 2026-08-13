import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SalesList } from "./sales-list";

describe("SalesList", () => {
  it("renders sale summaries", () => {
    render(
      <SalesList
        sales={[
          {
            cashSessionId: "cash-session-1",
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
    expect(screen.getByText("1 venda(s) encontrada(s)")).toBeInTheDocument();
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

  it("filters sales by status", async () => {
    const user = userEvent.setup();

    render(
      <SalesList
        sales={[
          {
            cashSessionId: "cash-session-1",
            completedAt: new Date("2026-07-10T12:00:00.000Z"),
            eventId: "event-1",
            eventName: "Evento concluido",
            id: "sale-1",
            status: "completed",
            totalInReais: 30,
          },
          {
            cashSessionId: "cash-session-1",
            completedAt: new Date("2026-07-10T13:00:00.000Z"),
            eventId: "event-1",
            eventName: "Evento cancelado",
            id: "sale-2",
            status: "canceled",
            totalInReais: 15,
          },
        ]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Status"), "canceled");

    expect(screen.getByText("Evento cancelado")).toBeInTheDocument();
    expect(screen.queryByText("Evento concluido")).not.toBeInTheDocument();
    expect(screen.getByText("1 venda(s) encontrada(s)")).toBeInTheDocument();
  });

  it("paginates sales", async () => {
    const user = userEvent.setup();

    render(
      <SalesList
        sales={Array.from({ length: 9 }, (_, index) => ({
          cashSessionId: "cash-session-1",
          completedAt: new Date("2026-07-10T12:00:00.000Z"),
          eventId: "event-1",
          eventName: `Evento ${index + 1}`,
          id: `sale-${index + 1}`,
          status: "completed" as const,
          totalInReais: index + 1,
        }))}
      />,
    );

    expect(screen.getByText("Mostrando 1-8 de 9 vendas")).toBeInTheDocument();
    expect(screen.getByText("Evento 1")).toBeInTheDocument();
    expect(screen.queryByText("Evento 9")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Proxima" }));

    expect(screen.getByText("Mostrando 9-9 de 9 vendas")).toBeInTheDocument();
    expect(screen.getByText("Evento 9")).toBeInTheDocument();
    expect(screen.queryByText("Evento 1")).not.toBeInTheDocument();
  });
});
