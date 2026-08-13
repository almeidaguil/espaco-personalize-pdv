import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CashSessionActionState } from "./cash-session-action-state";
import { CloseCashSessionForm } from "./close-cash-session-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: vi.fn(),
  };
});

const useActionStateMock = vi.mocked(useActionState);

describe("CloseCashSessionForm", () => {
  it("renders open cash session cards with reconciliation summary", () => {
    mockActionState({});

    render(
      <CloseCashSessionForm
        action={vi.fn()}
        sessions={[
          {
            canceledSalesCount: 1,
            canceledSalesTotalInReais: 10,
            completedSalesCount: 2,
            completedSalesTotalInReais: 100,
            expectedAmountInReais: 250.5,
            id: "cash-session-1",
            label: "Evento Julho - aberto em 10/07/2026, 09:00",
            openingAmountInReais: 150.5,
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Evento Julho - aberto em 10/07/2026, 09:00"),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 250,50")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor contado no caixa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fechar caixa" }),
    ).toBeInTheDocument();
  });

  it("requires admin password when counted amount is lower than expected", async () => {
    const user = userEvent.setup();
    mockActionState({});

    render(
      <CloseCashSessionForm
        action={vi.fn()}
        sessions={[
          {
            canceledSalesCount: 0,
            canceledSalesTotalInReais: 0,
            completedSalesCount: 2,
            completedSalesTotalInReais: 100,
            expectedAmountInReais: 250.5,
            id: "cash-session-1",
            label: "Evento Julho",
            openingAmountInReais: 150.5,
          },
        ]}
      />,
    );

    expect(screen.queryByLabelText("Senha administrativa")).toBeNull();

    await user.type(screen.getByLabelText("Valor contado no caixa"), "200,00");

    expect(screen.getByText("Diferenca: faltam R$ 50,50")).toBeInTheDocument();
    expect(screen.getByText("Faltam R$ 50,50 no caixa.")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha administrativa")).toBeInTheDocument();
  });

  it("shows positive and balanced cash differences", async () => {
    const user = userEvent.setup();
    mockActionState({});

    render(
      <CloseCashSessionForm
        action={vi.fn()}
        sessions={[
          {
            canceledSalesCount: 0,
            canceledSalesTotalInReais: 0,
            completedSalesCount: 2,
            completedSalesTotalInReais: 100,
            expectedAmountInReais: 250.5,
            id: "cash-session-1",
            label: "Evento Julho",
            openingAmountInReais: 150.5,
          },
        ]}
      />,
    );

    await user.type(screen.getByLabelText("Valor contado no caixa"), "250,50");

    expect(screen.getByText("Diferenca: sem divergencia")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Valor contado no caixa"));
    await user.type(screen.getByLabelText("Valor contado no caixa"), "300,50");

    expect(screen.getByText("Diferenca: sobram R$ 50,00")).toBeInTheDocument();
  });

  it("renders field errors and success messages", () => {
    mockActionState({
      fieldErrors: {
        cashSessionId: "Informe o caixa aberto.",
        countedAmountInReais: "Informe o valor contado em Reais.",
      },
      successMessage: "Caixa fechado com sucesso.",
    });

    render(
      <CloseCashSessionForm
        action={vi.fn()}
        sessions={[
          {
            canceledSalesCount: 0,
            canceledSalesTotalInReais: 0,
            completedSalesCount: 0,
            completedSalesTotalInReais: 0,
            expectedAmountInReais: 150.5,
            id: "cash-session-1",
            label: "Evento Julho",
            openingAmountInReais: 150.5,
          },
        ]}
      />,
    );

    expect(screen.getByText("Informe o caixa aberto.")).toBeInTheDocument();
    expect(
      screen.getByText("Informe o valor contado em Reais."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Valor contado no caixa")).toHaveAttribute(
      "aria-describedby",
      "countedAmountInReais-error-cash-session-1",
    );
    expect(screen.getByLabelText("Valor contado no caixa")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByText("Informe o caixa aberto.").closest("form"),
    ).toHaveAttribute("aria-describedby", "cashSessionId-error-cash-session-1");
    expect(screen.getByText("Caixa fechado com sucesso.")).toBeInTheDocument();
  });
});

function mockActionState(state: CashSessionActionState) {
  useActionStateMock.mockReturnValue([state, vi.fn(), false]);
}
