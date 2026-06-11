import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewEventPage from "./page";

vi.mock("@/modules/events/presentation/create-event-action", () => ({
  createEventAction: vi.fn(),
}));

vi.mock("@/modules/events/presentation/event-form", () => ({
  EventForm: () => <form aria-label="Formulario de evento" />,
}));

describe("NewEventPage", () => {
  it("renders the event creation page", () => {
    render(<NewEventPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Novo evento" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Eventos" })).toHaveAttribute(
      "href",
      "/events",
    );
    expect(screen.getByLabelText("Formulario de evento")).toBeInTheDocument();
  });
});
