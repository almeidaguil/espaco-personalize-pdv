import { describe, expect, it } from "vitest";

import { createSalesReportFixture } from "../testing/sales-report-fixture";
import { exportSalesReportCsvUseCase } from "./export-sales-report-csv-use-case";

describe("exportSalesReportCsvUseCase", () => {
  it("exports the same canonical totals, payments, products and sessions", () => {
    const result = exportSalesReportCsvUseCase({
      report: createSalesReportFixture(),
    });

    expect(result.filename).toBe(
      "relatorio-vendas-2026-10-02-a-2026-10-02.csv",
    );
    expect(result.mimeType).toBe("text/csv; charset=utf-8");
    expect(result.content).toContain(
      "Resumo;vendas_concluidas;Vendas concluídas;2;45,00",
    );
    expect(result.content).toContain(
      "Resumo;vendas_canceladas;Vendas canceladas (fora da receita);1;15,00",
    );
    expect(result.content).toContain("Pagamento;cash;Dinheiro;1;30,00");
    expect(result.content).toContain(
      "Produto;33333333-3333-4333-8333-333333333333;Chaveiro Polvo;3;45,00",
    );
    expect(result.content).toContain(
      "Divergência de caixa;22222222-2222-4222-8222-222222222222;Ana Vendedora;;-1,00",
    );
  });

  it("neutralizes spreadsheet formulas and escapes CSV metacharacters", () => {
    const result = exportSalesReportCsvUseCase({
      report: createSalesReportFixture({
        items: [
          {
            grossTotalInCents: 100,
            productId: "33333333-3333-4333-8333-333333333333",
            productName: '\n=HYPERLINK("https://example.test";"Clique")',
            quantity: 1,
          },
        ],
      }),
    });

    expect(result.content).toContain(
      '"\'\n=HYPERLINK(""https://example.test"";""Clique"")"',
    );
  });

  it("keeps generated negative money numeric and neutralizes untrusted minus text", () => {
    const result = exportSalesReportCsvUseCase({
      report: createSalesReportFixture({
        items: [
          {
            grossTotalInCents: 100,
            productId: "33333333-3333-4333-8333-333333333333",
            productName: "-produto",
            quantity: 1,
          },
        ],
      }),
    });

    expect(result.content).toContain(";'-produto;1;1,00");
    expect(result.content).toContain(";Ana Vendedora;;-1,00");
  });

  it("exports post-close adjustments separately from recognized revenue", () => {
    const result = exportSalesReportCsvUseCase({
      report: createSalesReportFixture({
        netRevenueInCents: -7000,
        postCloseAdjustmentPaymentSummary: [
          { method: "cash", netTotalInCents: 0, salesCount: 0 },
          { method: "pix", netTotalInCents: 0, salesCount: 0 },
          { method: "credit_card", netTotalInCents: 0, salesCount: 0 },
          { method: "debit_card", netTotalInCents: 7000, salesCount: 1 },
        ],
        postCloseAdjustmentsCount: 1,
        postCloseAdjustmentsTotalInCents: 7000,
      }),
    });

    expect(result.content).toContain(
      "Resumo;receita_liquida;Receita líquida após ajustes pós-fechamento;;-70,00",
    );
    expect(result.content).toContain(
      "Resumo;ajustes_pos_fechamento;Cancelamentos ajustados após o fechamento;1;70,00",
    );
    expect(result.content).toContain(
      "Ajuste pós-fechamento;debit_card;Cartão de débito;1;70,00",
    );
  });
});
