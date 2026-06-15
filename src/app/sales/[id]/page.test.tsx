import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import SaleDetailsPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/sales/infra/supabase-sale-detail-repository", () => ({
  SupabaseSaleDetailRepository: vi.fn(),
}));

const getSaleDetailUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/sales/application/get-sale-detail-use-case", () => ({
  getSaleDetailUseCase: getSaleDetailUseCaseMock,
}));

describe("SaleDetailsPage", () => {
  it("renders sale details", async () => {
    getSaleDetailUseCaseMock.mockResolvedValueOnce({
      sale: {
        cashSessionId: "cash-session-1",
        completedAt: new Date("2026-07-10T12:00:00.000Z"),
        eventId: "event-1",
        eventName: "Evento Julho",
        id: "sale-1",
        items: [
          {
            productId: "product-1",
            productName: "Chaveiro Polvo",
            quantity: 2,
            totalInReais: 30,
            unitPriceInReais: 15,
          },
        ],
        payment: {
          amountInReais: 50,
          changeInReais: 20,
          method: "cash",
        },
        status: "completed",
        totalInReais: 30,
      },
      success: true,
    });

    render(
      await SaleDetailsPage({
        params: Promise.resolve({ id: "sale-1" }),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Detalhe da venda" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(screen.getByText("Chaveiro Polvo")).toBeInTheDocument();
  });

  it("renders not found for missing sales", async () => {
    getSaleDetailUseCaseMock.mockResolvedValueOnce({
      error: "not_found",
      success: false,
    });

    await expect(
      SaleDetailsPage({
        params: Promise.resolve({ id: "missing-sale" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders load errors", async () => {
    getSaleDetailUseCaseMock.mockResolvedValueOnce({
      error: "unknown",
      success: false,
    });

    render(
      await SaleDetailsPage({
        params: Promise.resolve({ id: "sale-1" }),
      }),
    );

    expect(
      screen.getByText("Nao foi possivel carregar a venda."),
    ).toBeInTheDocument();
  });
});
