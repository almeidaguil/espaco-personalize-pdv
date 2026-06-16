import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineStatus } from "./offline-status";

function mockOnlineStatus(isOnline: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(isOnline);
}

function mockFetch(ok: boolean) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
    })),
  );
}

describe("OfflineStatus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not show an alert while online", async () => {
    mockOnlineStatus(true);
    mockFetch(true);

    render(<OfflineStatus />);

    await act(async () => {});

    expect(screen.queryByText(/sem conexao/i)).not.toBeInTheDocument();
  });

  it("shows an alert when the browser really goes offline", async () => {
    mockOnlineStatus(true);
    mockFetch(false);

    render(<OfflineStatus />);

    mockOnlineStatus(false);
    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(await screen.findByText(/sem conexao/i)).toBeInTheDocument();
  });

  it("keeps the app marked online when the browser reports offline incorrectly", async () => {
    mockOnlineStatus(false);
    mockFetch(true);

    render(<OfflineStatus />);

    await act(async () => {});

    expect(screen.queryByText(/sem conexao/i)).not.toBeInTheDocument();
  });

  it("hides the alert when the browser returns online", async () => {
    mockOnlineStatus(false);
    mockFetch(false);

    render(<OfflineStatus />);

    expect(await screen.findByText(/sem conexao/i)).toBeInTheDocument();

    mockOnlineStatus(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByText(/sem conexao/i)).not.toBeInTheDocument();
  });
});
