import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OpenCashPage from "./page";

vi.mock("@/shared/components/app-navigation", () => ({
  AppNavigation: () => null,
}));

vi.mock("@/modules/cash/presentation/open-cash-session-action", () => ({
  openCashSessionAction: vi.fn(),
}));

vi.mock("@/modules/cash/presentation/open-cash-session-form", () => ({
  OpenCashSessionForm: () => <form aria-label="Formulario de abertura" />,
}));

describe("OpenCashPage", () => {
  it("renders the event-free cash opening page", async () => {
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
    expect(screen.getByLabelText("Formulario de abertura")).toBeInTheDocument();
  });
});
