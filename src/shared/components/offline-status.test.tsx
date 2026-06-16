import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineStatus } from "./offline-status";

function mockOnlineStatus(isOnline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(isOnline);
}

describe("OfflineStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not show an alert while online", () => {
    mockOnlineStatus(true);

    render(<OfflineStatus />);

    expect(screen.queryByText(/sem conexao/i)).not.toBeInTheDocument();
  });

  it("shows an alert when the browser goes offline", () => {
    mockOnlineStatus(true);

    render(<OfflineStatus />);

    mockOnlineStatus(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(/sem conexao/i)).toBeInTheDocument();
  });

  it("hides the alert when the browser returns online", () => {
    mockOnlineStatus(false);

    render(<OfflineStatus />);

    expect(screen.getByText(/sem conexao/i)).toBeInTheDocument();

    mockOnlineStatus(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByText(/sem conexao/i)).not.toBeInTheDocument();
  });
});
