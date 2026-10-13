import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OpenCashPage from "./page";

vi.mock("@/shared/components/app-navigation", () => ({
  AppNavigation: () => null,
}));

vi.mock("@/modules/cash/presentation/open-cash-session-action", () => ({
  openCashSessionAction: vi.fn(),
}));

describe("OpenCashPage", () => {
  it("offers the opening amount form for the authenticated operator cash", async () => {
    render(await OpenCashPage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Abrir caixa",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Voltar para o PDV",
      }),
    ).toHaveAttribute("href", "/pdv");
    expect(
      screen.getByRole("link", {
        name: "Fechar caixa",
      }),
    ).toHaveAttribute("href", "/cash/close");
    expect(
      screen.getByRole("textbox", { name: "Valor inicial" }),
    ).toHaveAttribute("name", "openingAmountInReais");
    expect(
      screen.getByRole("button", { name: "Abrir caixa" }),
    ).toBeInTheDocument();
  });
});
