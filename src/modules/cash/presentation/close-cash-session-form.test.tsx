import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useActionState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CloseCashSessionForm,
  type CloseCashSessionOption,
} from "./close-cash-session-form";

vi.mock("react", async () => ({
  ...(await vi.importActual<typeof import("react")>("react")),
  useActionState: vi.fn(),
}));
const useActionStateMock = vi.mocked(useActionState);

describe("CloseCashSessionForm", () => {
  beforeEach(() => useActionStateMock.mockReturnValue([{}, vi.fn(), false]));

  it("requires four initially empty method counts and enables only when complete", async () => {
    const user = userEvent.setup();
    render(<CloseCashSessionForm action={vi.fn()} sessions={[fixture()]} />);

    const button = screen.getByRole("button", { name: "Fechar caixa" });
    expect(button).toBeDisabled();
    for (const label of [
      "Dinheiro",
      "Pix",
      "Cartão de crédito",
      "Cartão de débito",
    ]) {
      expect(screen.getByLabelText(`Valor conferido — ${label}`)).toHaveValue(
        "",
      );
    }

    await user.type(
      screen.getByLabelText("Valor conferido — Dinheiro"),
      "0,00",
    );
    await user.type(screen.getByLabelText("Valor conferido — Pix"), "0,00");
    await user.type(
      screen.getByLabelText("Valor conferido — Cartão de crédito"),
      "200,00",
    );
    await user.type(
      screen.getByLabelText("Valor conferido — Cartão de débito"),
      "0,00",
    );
    expect(screen.getAllByText("Sem divergência")).toHaveLength(4);
    expect(button).toBeEnabled();
    expect(screen.queryByLabelText("Senha administrativa")).toBeNull();
  });

  it("shows each real difference and admin password for opposite differences", async () => {
    const user = userEvent.setup();
    render(
      <CloseCashSessionForm
        action={vi.fn()}
        sessions={[
          fixture({
            expectedByMethodInCents: {
              cash: 1000,
              pix: 1000,
              credit_card: 0,
              debit_card: 0,
            },
          }),
        ]}
      />,
    );
    await user.type(
      screen.getByLabelText("Valor conferido — Dinheiro"),
      "15,00",
    );
    await user.type(screen.getByLabelText("Valor conferido — Pix"), "5,00");
    await user.type(
      screen.getByLabelText("Valor conferido — Cartão de crédito"),
      "0,00",
    );
    await user.type(
      screen.getByLabelText("Valor conferido — Cartão de débito"),
      "0,00",
    );
    expect(screen.getByText("Sobra: R$ 5,00")).toBeInTheDocument();
    expect(screen.getByText("Falta: R$ 5,00")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha administrativa")).toBeInTheDocument();
  });
});

function fixture(
  overrides: Partial<CloseCashSessionOption> = {},
): CloseCashSessionOption {
  return {
    canceledSalesCount: 0,
    canceledSalesTotalInCents: 0,
    completedSalesCount: 1,
    completedSalesTotalInCents: 20000,
    expectedByMethodInCents: {
      cash: 0,
      credit_card: 20000,
      debit_card: 0,
      pix: 0,
    },
    id: "cash-session-1",
    label: "Ana Souza",
    openingAmountInCents: 0,
    ...overrides,
  };
}
