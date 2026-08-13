import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders the label with status styling", () => {
    render(<StatusBadge tone="success">Ativo</StatusBadge>);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
  });
});
