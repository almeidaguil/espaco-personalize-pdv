import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SalesList } from "./sales-list";
import { saleSummaryFixture } from "../testing/sale-summary-fixture";

describe("SalesList", () => {
  it("identifies sales by operator and cash session", () => {
    render(
      <SalesList
        sales={[saleSummaryFixture()]}
        totalCount={1}
        filters={{ page: 1, pageSize: 8 }}
      />,
    );
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText(/Caixa cash-ses/)).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver detalhes" })).toHaveAttribute(
      "href",
      "/sales/sale-1",
    );
  });
  it("preserves server filters when navigating pages", () => {
    render(
      <SalesList
        sales={[saleSummaryFixture()]}
        totalCount={17}
        filters={{
          page: 2,
          pageSize: 8,
          operatorId: "operator-1",
          status: "canceled",
          startDate: "2026-07-01",
        }}
      />,
    );
    const next = screen
      .getByRole("link", { name: "Próxima" })
      .getAttribute("href")!;
    const parameters = new URL(next, "http://localhost").searchParams;
    expect(parameters.get("page")).toBe("3");
    expect(parameters.get("operatorId")).toBe("operator-1");
    expect(parameters.get("status")).toBe("canceled");
    expect(parameters.get("startDate")).toBe("2026-07-01");
    expect(screen.getByText("17 vendas")).toBeInTheDocument();
  });
  it("renders empty search results and a way back from an out-of-range page", () => {
    render(
      <SalesList
        sales={[]}
        totalCount={0}
        filters={{ page: 3, pageSize: 8 }}
      />,
    );
    expect(
      screen.getByText("Nenhuma venda encontrada para estes filtros."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/sales?page=2",
    );
  });
});
