import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Panel } from "./panel";

describe("Panel", () => {
  it("renders content inside a section by default", () => {
    render(<Panel>Conteudo do painel</Panel>);

    expect(
      screen.getByText("Conteudo do painel").closest("section"),
    ).toHaveClass("rounded-md", "border", "bg-white", "p-5", "shadow-sm");
  });

  it("supports alternate elements and custom classes", () => {
    render(
      <Panel as="li" className="grid gap-2" padding="sm">
        Painel compacto
      </Panel>,
    );

    expect(screen.getByText("Painel compacto").closest("li")).toHaveClass(
      "grid",
      "gap-2",
      "p-4",
    );
  });

  it("can render without padding", () => {
    render(<Panel padding="none">Painel sem padding</Panel>);

    expect(
      screen.getByText("Painel sem padding").closest("section"),
    ).not.toHaveClass("p-4", "p-5");
  });
});
