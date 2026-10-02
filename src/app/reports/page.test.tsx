import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createSalesReportFixture } from "@/modules/reports/testing/sales-report-fixture";

import ReportsPage from "./page";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("@/shared/components/app-navigation", () => ({
  AppNavigation: () => null,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/modules/reports/infra/supabase-sales-report-repository", () => ({
  SupabaseSalesReportRepository: vi.fn(),
}));

const getSalesReportUseCaseMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/reports/application/get-sales-report-use-case", () => ({
  getSalesReportUseCase: getSalesReportUseCaseMock,
}));

describe("ReportsPage", () => {
  it("renders a report with period, operator and cash-session filters", async () => {
    getSalesReportUseCaseMock.mockResolvedValueOnce({
      report: createSalesReportFixture(),
      success: true,
    });

    render(
      await ReportsPage({
        searchParams: Promise.resolve({
          cashSessionId: "22222222-2222-4222-8222-222222222222",
          endDate: "2026-10-03",
          itemsPage: "2",
          operatorId: "11111111-1111-4111-8111-111111111111",
          sessionsPage: "3",
          startDate: "2026-10-02",
        }),
      }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Relatórios" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Data inicial")).toHaveValue("2026-10-02");
    expect(screen.getByLabelText("Data final")).toHaveValue("2026-10-03");
    expect(getSalesReportUseCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          cashSessionId: "22222222-2222-4222-8222-222222222222",
          endDate: "2026-10-03",
          itemsPage: 2,
          operatorId: "11111111-1111-4111-8111-111111111111",
          pageSize: 8,
          sessionsPage: 3,
          startDate: "2026-10-02",
        },
      }),
    );
  });

  it("forwards actionable filter validation errors", async () => {
    getSalesReportUseCaseMock.mockResolvedValueOnce({
      formError: "O período máximo permitido é de 366 dias.",
      success: false,
    });

    render(
      await ReportsPage({
        searchParams: Promise.resolve({
          endDate: "2026-12-31",
          startDate: "2025-01-01",
        }),
      }),
    );

    expect(
      screen.getByText("O período máximo permitido é de 366 dias."),
    ).toBeInTheDocument();
  });
});
