import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound", () => {
  it("explains an unavailable address and offers a return to the dashboard", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Página não encontrada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar ao painel" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByText("Roberto Multimarcas")).toBeInTheDocument();
    expect(
      screen.getByText(
        "O endereço informado não existe ou não está mais disponível.",
      ),
    ).toBeInTheDocument();
  });
});
