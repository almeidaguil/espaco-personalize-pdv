import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModulePlaceholder } from "./module-placeholder";

describe("ModulePlaceholder", () => {
  it("renders module status and navigation links", () => {
    render(
      <ModulePlaceholder
        description="Descricao do modulo."
        nextStep="Proximo passo."
        title="Modulo teste"
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Modulo teste" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Em desenvolvimento")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar ao painel" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Ver produtos" })).toHaveAttribute(
      "href",
      "/products",
    );
  });
});
