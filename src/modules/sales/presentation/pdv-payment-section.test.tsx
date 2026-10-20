import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { PaymentDraft } from "./pdv-payment";
import { PdvPaymentSection } from "./pdv-payment-section";

describe("PdvPaymentSection", () => {
  it("adds and removes a distinct second payment", async () => {
    const user = userEvent.setup();
    render(<PaymentHarness />);

    await user.click(screen.getByRole("button", { name: "Dividir pagamento" }));

    expect(
      screen.getAllByRole("combobox", { name: /Forma de pagamento/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
    ).toHaveValue("cash");
    expect(
      screen.getByRole("combobox", { name: "Forma de pagamento 2" }),
    ).toHaveValue("pix");
    expect(
      within(
        screen.getByRole("combobox", { name: "Forma de pagamento 2" }),
      ).getByRole("option", { name: "Dinheiro" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Remover segunda forma" }),
    );
    expect(
      screen.getAllByRole("combobox", { name: /Forma de pagamento/ }),
    ).toHaveLength(1);
  });

  it("allows editing both values in a split payment", async () => {
    const user = userEvent.setup();
    render(<PaymentHarness />);

    await user.click(screen.getByRole("button", { name: "Dividir pagamento" }));
    await user.type(screen.getByLabelText("Valor do pagamento 1"), "10,00");
    await user.type(screen.getByLabelText("Valor do pagamento 2"), "5,00");

    expect(screen.getByText("Total informado").parentElement).toHaveTextContent(
      "R$ 15,00",
    );
    expect(screen.getByText("Restante").parentElement).toHaveTextContent(
      "R$ 0,00",
    );
  });

  it("shows the entered credit amount and remaining balance before cash is entered", async () => {
    const user = userEvent.setup();
    render(<PaymentHarness totalInCents={7000} />);

    await user.click(screen.getByRole("button", { name: "Dividir pagamento" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
      "credit_card",
    );
    await user.click(screen.getByRole("radio", { name: "3x" }));
    await user.type(screen.getByLabelText("Valor do pagamento 1"), "50,00");

    expect(screen.getByText("Total informado").parentElement).toHaveTextContent(
      "R$ 50,00",
    );
    expect(screen.getByText("Restante").parentElement).toHaveTextContent(
      "R$ 20,00",
    );
  });

  it("selects credit installments and shows the approximate installment", async () => {
    const user = userEvent.setup();
    render(<PaymentHarness />);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Forma de pagamento 1" }),
      "credit_card",
    );
    await user.click(screen.getByRole("radio", { name: "3x" }));

    expect(screen.getByDisplayValue("15,00")).toHaveAttribute("readonly");
    expect(
      screen.getByText(/3 parcelas de aproximadamente R\$ 5,00/),
    ).toBeInTheDocument();
  });

  it("reports cash change and exposes the server error accessibly", async () => {
    const user = userEvent.setup();
    render(<PaymentHarness errorMessage="Pagamento recusado." />);

    await user.type(screen.getByLabelText("Valor recebido"), "20,00");

    expect(screen.getByText("Troco").parentElement).toHaveTextContent(
      "R$ 5,00",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Pagamento recusado.");
  });
});

function PaymentHarness({
  errorMessage,
  totalInCents = 1500,
}: {
  errorMessage?: string;
  totalInCents?: number;
}) {
  const [drafts, setDrafts] = useState<PaymentDraft[]>([
    { amountInput: "", method: "cash" },
  ]);

  return (
    <PdvPaymentSection
      drafts={drafts}
      errorMessage={errorMessage}
      onChange={setDrafts}
      totalInCents={totalInCents}
    />
  );
}
