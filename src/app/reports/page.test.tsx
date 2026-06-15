import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ReportsPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));

vi.mock("@/modules/events/infra/supabase-event-repository", () => ({
  SupabaseEventRepository: vi.fn(),
}));

vi.mock(
  "@/modules/reports/infra/supabase-sales-by-event-report-repository",
  () => ({
    SupabaseSalesByEventReportRepository: vi.fn(),
  }),
);

const listEventsUseCaseMock = vi.hoisted(() => vi.fn());
const getSalesByEventReportUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/events/application/list-events-use-case", () => ({
  listEventsUseCase: listEventsUseCaseMock,
}));

vi.mock(
  "@/modules/reports/application/get-sales-by-event-report-use-case",
  () => ({
    getSalesByEventReportUseCase: getSalesByEventReportUseCaseMock,
  }),
);

describe("ReportsPage", () => {
  it("renders the report for the selected event", async () => {
    listEventsUseCaseMock.mockResolvedValueOnce({
      events: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          isActive: true,
          name: "Evento Julho",
          startsAt: new Date("2026-07-10T09:00:00.000Z"),
        },
      ],
      success: true,
    });
    getSalesByEventReportUseCaseMock.mockResolvedValueOnce({
      report: {
        canceledSalesCount: 1,
        canceledTotalInReais: 15,
        completedSalesCount: 2,
        eventId: "11111111-1111-4111-8111-111111111111",
        eventName: "Evento Julho",
        grossTotalInReais: 45,
        items: [],
      },
      success: true,
    });

    render(
      await ReportsPage({
        searchParams: Promise.resolve({
          eventId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Relatorios" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Evento Julho")).toBeInTheDocument();
    expect(getSalesByEventReportUseCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });
});
