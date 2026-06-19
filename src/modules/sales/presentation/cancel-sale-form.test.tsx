import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CancelSaleActionState } from "./cancel-sale-action-state";
import { CancelSaleForm } from "./cancel-sale-form";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useActionState: vi.fn(),
  };
});

const useActionStateMock = vi.mocked(useActionState);

describe("CancelSaleForm", () => {
  it("requires confirmation before enabling the cancel sale action", async () => {
    const user = userEvent.setup();
    mockActionState({});

    render(
      <CancelSaleForm action={vi.fn()} isCanceled={false} saleId="sale-1" />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Cancelamento" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Senha administrativa")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Cancelar venda" });
    const checkbox = screen.getByRole("checkbox", {
      name: /Confirmo que esta venda deve ser cancelada/,
    });

    expect(button).toBeDisabled();

    await user.click(checkbox);

    expect(button).toBeEnabled();
  });

  it("disables cancellation for canceled sales", () => {
    mockActionState({});

    render(
      <CancelSaleForm action={vi.fn()} isCanceled={true} saleId="sale-1" />,
    );

    expect(
      screen.getByRole("button", { name: "Venda cancelada" }),
    ).toBeDisabled();
  });

  it("renders action feedback", () => {
    mockActionState({
      formError: "Nao foi possivel cancelar a venda.",
      successMessage: "Venda cancelada com sucesso.",
    });

    render(
      <CancelSaleForm action={vi.fn()} isCanceled={false} saleId="sale-1" />,
    );

    expect(
      screen.getByText("Nao foi possivel cancelar a venda."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Venda cancelada com sucesso."),
    ).toBeInTheDocument();
  });
});

function mockActionState(state: CancelSaleActionState) {
  useActionStateMock.mockReturnValue([state, vi.fn(), false]);
}
