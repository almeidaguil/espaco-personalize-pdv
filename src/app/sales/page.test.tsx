import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import SalesPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/sales/infra/supabase-sale-summary-repository", () => ({
  SupabaseSaleSummaryRepository: vi.fn(),
}));

const listSalesUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/sales/application/list-sales-use-case", () => ({
  listSalesUseCase: listSalesUseCaseMock,
}));

describe("SalesPage", () => {
  it("renders sale summaries", async () => {
    listSalesUseCaseMock.mockResolvedValueOnce({
      sales: [
        {
          completedAt: new Date("2026-07-10T12:00:00.000Z"),
          eventId: "event-1",
          eventName: "Evento Julho",
          id: "sale-1",
          status: "completed",
          totalInReais: 30,
        },
      ],
      success: true,
    });

    render(await SalesPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Vendas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
  });

  it("renders load errors", async () => {
    listSalesUseCaseMock.mockResolvedValueOnce({
      error: "unknown",
      success: false,
    });

    render(await SalesPage());

    expect(
      screen.getByText("Nao foi possivel carregar as vendas."),
    ).toBeInTheDocument();
  });
});
