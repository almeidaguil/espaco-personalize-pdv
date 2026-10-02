import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createSalesReportFixture } from "../testing/sales-report-fixture";
import { SalesReport } from "./sales-report";

const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

const filters = {
  endDate: "2026-10-02",
  startDate: "2026-10-02",
};

describe("SalesReport", () => {
  it("renders period, filters, canonical totals and the matching CSV link", () => {
    render(
      <SalesReport filters={filters} report={createSalesReportFixture()} />,
    );

    expect(screen.getByLabelText("Data inicial")).toHaveValue("2026-10-02");
    expect(screen.getByLabelText("Vendedor")).toBeInTheDocument();
    expect(screen.getByLabelText("Sessão de caixa")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 45,00")).toHaveLength(3);
    expect(screen.getByText("1 (R$ 15,00)")).toBeInTheDocument();
    expect(screen.getByText("R$ 2,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 1,00")).toBeInTheDocument();
    expect(screen.getByText("-R$ 1,00")).toBeInTheDocument();
    expect(screen.getByText("Chaveiro Polvo")).toBeInTheDocument();
    expect(screen.getByText(/17:00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute(
      "href",
      "/reports/export?endDate=2026-10-02&startDate=2026-10-02",
    );
  });

  it("renders a controlled error state", () => {
    render(<SalesReport filters={filters} report={null} />);

    expect(
      screen.getByText(
        "Não foi possível carregar o relatório com os filtros informados.",
      ),
    ).toBeInTheDocument();
  });

  it("renders an actionable filter validation error", () => {
    render(
      <SalesReport
        errorMessage="O período máximo permitido é de 366 dias."
        filters={filters}
        report={null}
      />,
    );

    expect(
      screen.getByText("O período máximo permitido é de 366 dias."),
    ).toBeInTheDocument();
  });

  it("shows post-close cancellations as separate financial adjustments", () => {
    render(
      <SalesReport
        filters={filters}
        report={createSalesReportFixture({
          netRevenueInCents: -7000,
          postCloseAdjustmentPaymentSummary: [
            { method: "cash", netTotalInCents: 0, salesCount: 0 },
            { method: "pix", netTotalInCents: 0, salesCount: 0 },
            { method: "credit_card", netTotalInCents: 0, salesCount: 0 },
            { method: "debit_card", netTotalInCents: 7000, salesCount: 1 },
          ],
          postCloseAdjustmentsCount: 1,
          postCloseAdjustmentsTotalInCents: 7000,
        })}
      />,
    );

    expect(
      screen.getByText("Cancelamentos após fechamento"),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 70,00 · 1 ajuste")).toBeInTheDocument();
    expect(screen.getByText("-R$ 70,00")).toBeInTheDocument();
  });

  it("requests the next product page without changing the report filters", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 8 }, (_, index) => ({
      grossTotalInCents: (index + 1) * 100,
      productId: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
      productName: `Produto ${index + 1}`,
      quantity: index + 1,
    }));

    render(
      <SalesReport
        filters={filters}
        report={createSalesReportFixture({ items, itemsTotalCount: 9 })}
      />,
    );

    expect(screen.getByText("Mostrando 1-8 de 9 itens")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Proxima" }));

    expect(routerPushMock).toHaveBeenCalledWith(
      "/reports?endDate=2026-10-02&itemsPage=2&sessionsPage=1&startDate=2026-10-02",
    );
    expect(screen.getByText("Receita líquida")).toBeInTheDocument();
  });
});
