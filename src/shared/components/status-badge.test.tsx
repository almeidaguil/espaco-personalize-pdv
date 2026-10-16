import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders the label with status styling", () => {
    render(<StatusBadge tone="success">Ativo</StatusBadge>);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Ativo").querySelector("[aria-hidden]")).toBeNull();
  });

  it("renders an optional decorative dot for an unavailable status", () => {
    render(
      <StatusBadge tone="danger" showDot>
        Inativo
      </StatusBadge>,
    );

    const badge = screen.getByText("Inativo");
    expect(badge).toHaveClass("text-red-700");
    expect(badge.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
