import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OpenCashSessionsPanel } from "./open-cash-sessions-panel";

describe("OpenCashSessionsPanel", () => {
  it("identifies every open cash session by seller, opening time, and short id", () => {
    render(
      <OpenCashSessionsPanel
        sessions={[
          {
            id: "a1b2c3d4-e5f6",
            openedAt: new Date("2026-10-03T09:00:00.000Z"),
            openingAmountInReais: 100,
            operatorId: "operator-1",
            operatorName: "Ana Souza",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Caixas abertos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent?.includes("a1b2c3d4") === true,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/03\/10\/2026/)).toBeInTheDocument();
  });
});
