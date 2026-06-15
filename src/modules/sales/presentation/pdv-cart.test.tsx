import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PdvCart } from "./pdv-cart";
import type { SaleActionState } from "./sale-action-state";

describe("PdvCart", () => {
  it("adds products and updates the preview total", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        cashSessions={createCashSessions()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
            sku: "CHAVEIRO-001",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.click(
      screen.getByRole("button", {
        name: "Adicionar uma unidade de Chaveiro Polvo",
      }),
    );

    expect(screen.getByText("2 x R$ 15,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
  });

  it("removes products from the cart", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        cashSessions={createCashSessions()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.click(
      screen.getByRole("button", {
        name: "Remover uma unidade de Chaveiro Polvo",
      }),
    );

    expect(screen.getByText("Nenhum item adicionado.")).toBeInTheDocument();
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("calculates cash change when received amount covers the total", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        cashSessions={createCashSessions()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.type(screen.getByLabelText("Valor recebido"), "20,00");

    expect(screen.getByText("Troco R$ 5,00")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Finalizar venda" }),
    ).toBeEnabled();
  });

  it("shows the missing amount when cash payment is insufficient", async () => {
    const user = userEvent.setup();

    render(
      <PdvCart
        action={createAction()}
        cashSessions={createCashSessions()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.type(screen.getByLabelText("Valor recebido"), "10,00");

    expect(screen.getByText("Falta R$ 5,00")).toBeInTheDocument();
  });

  it("renders an empty products state", () => {
    render(
      <PdvCart
        action={createAction()}
        cashSessions={createCashSessions()}
        products={[]}
      />,
    );

    expect(
      screen.getByText("Nenhum produto ativo disponivel para venda."),
    ).toBeInTheDocument();
  });

  it("submits the sale intent to the server action", async () => {
    const user = userEvent.setup();
    const action = createAction();

    render(
      <PdvCart
        action={action}
        cashSessions={createCashSessions()}
        products={[
          {
            id: "product-1",
            name: "Chaveiro Polvo",
            priceInReais: 15,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await user.type(screen.getByLabelText("Valor recebido"), "20,00");
    await user.click(screen.getByRole("button", { name: "Finalizar venda" }));

    expect(action).toHaveBeenCalled();
    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(formData.get("cashSessionId")).toBe("cash-session-1");
    expect(formData.get("eventId")).toBe("event-1");
    expect(formData.get("amountReceivedInReais")).toBe("20,00");
    expect(formData.get("itemsJson")).toBe(
      JSON.stringify([
        {
          productId: "product-1",
          quantity: 1,
        },
      ]),
    );
  });
});

function createAction() {
  return vi.fn(
    async (
      _previousState: SaleActionState,
      _formData: FormData,
    ): Promise<SaleActionState> => {
      void _previousState;
      void _formData;

      return {
        successMessage: "Venda finalizada com sucesso.",
      };
    },
  );
}

function createCashSessions() {
  return [
    {
      eventId: "event-1",
      eventName: "Evento Julho",
      id: "cash-session-1",
    },
  ];
}
