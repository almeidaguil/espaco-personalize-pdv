import { render, screen } from "@testing-library/react";
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
  it("renders open cash session options", () => {
    mockActionState({});

    render(
      <CloseCashSessionForm
        action={vi.fn()}
        sessions={[
          {
            id: "cash-session-1",
            label: "Evento Julho - aberto em 10/07/2026, 09:00",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Caixa aberto")).toBeInTheDocument();
    expect(
      screen.getByRole("option", {
        name: "Evento Julho - aberto em 10/07/2026, 09:00",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fechar caixa" }),
    ).toBeInTheDocument();
  });

  it("renders field errors and success messages", () => {
    mockActionState({
      fieldErrors: {
        cashSessionId: "Informe o caixa aberto.",
      },
      successMessage: "Caixa fechado com sucesso.",
    });

    render(<CloseCashSessionForm action={vi.fn()} sessions={[]} />);

    expect(screen.getByText("Informe o caixa aberto.")).toBeInTheDocument();
    expect(screen.getByText("Caixa fechado com sucesso.")).toBeInTheDocument();
  });
});

function mockActionState(state: CashSessionActionState) {
  useActionStateMock.mockReturnValue([state, vi.fn(), false]);
}
