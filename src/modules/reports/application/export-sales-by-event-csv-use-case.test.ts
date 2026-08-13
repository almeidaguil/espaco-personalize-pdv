import { describe, expect, it } from "vitest";

import { exportSalesByEventCsvUseCase } from "./export-sales-by-event-csv-use-case";

describe("exportSalesByEventCsvUseCase", () => {
  it("exports summary and sold items as semicolon separated CSV", () => {
    const result = exportSalesByEventCsvUseCase({
      report: {
        canceledSalesCount: 1,
        canceledTotalInReais: 15,
        completedSalesCount: 2,
        eventId: "event-1",
        eventName: "Evento Julho",
        grossTotalInReais: 45,
        items: [
          {
            grossTotalInReais: 30,
            productId: "product-1",
            productName: 'Chaveiro "Polvo"',
            quantity: 2,
          },
        ],
        paymentSummary: [
          {
            method: "cash",
            netTotalInReais: 30,
            salesCount: 1,
          },
          {
            method: "pix",
            netTotalInReais: 15,
            salesCount: 1,
          },
          {
            method: "credit_card",
            netTotalInReais: 0,
            salesCount: 0,
          },
          {
            method: "debit_card",
            netTotalInReais: 0,
            salesCount: 0,
          },
        ],
      },
    });

    expect(result.filename).toBe("relatorio-evento-julho.csv");
    expect(result.mimeType).toBe("text/csv; charset=utf-8");
    expect(result.content).toContain("Resumo;Vendas concluidas;2;45,00");
    expect(result.content).toContain("Pagamento;Dinheiro;1;30,00");
    expect(result.content).toContain("Pagamento;Pix;1;15,00");
    expect(result.content).toContain('Produto;"Chaveiro ""Polvo""";2;30,00');
  });
});
