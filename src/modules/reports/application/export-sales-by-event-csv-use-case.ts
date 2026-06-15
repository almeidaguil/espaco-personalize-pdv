import type { SalesByEventReport } from "./sales-by-event-report-repository";

export type ExportSalesByEventCsvInput = {
  report: SalesByEventReport;
};

export type ExportSalesByEventCsvResult = {
  content: string;
  filename: string;
  mimeType: "text/csv; charset=utf-8";
};

export function exportSalesByEventCsvUseCase({
  report,
}: ExportSalesByEventCsvInput): ExportSalesByEventCsvResult {
  const rows = [
    ["Secao", "Nome", "Quantidade", "Valor em reais"],
    [
      "Resumo",
      "Vendas concluidas",
      String(report.completedSalesCount),
      formatCsvMoney(report.grossTotalInReais),
    ],
    [
      "Resumo",
      "Vendas canceladas",
      String(report.canceledSalesCount),
      formatCsvMoney(report.canceledTotalInReais),
    ],
    ...report.items.map((item) => [
      "Produto",
      item.productName,
      String(item.quantity),
      formatCsvMoney(item.grossTotalInReais),
    ]),
  ];

  return {
    content: rows.map(toCsvRow).join("\n"),
    filename: `relatorio-${slugify(report.eventName)}.csv`,
    mimeType: "text/csv; charset=utf-8",
  };
}

function toCsvRow(values: string[]): string {
  return values.map(escapeCsvValue).join(";");
}

function escapeCsvValue(value: string): string {
  const escapedValue = value.replaceAll('"', '""');

  if (/[;"\n\r]/.test(escapedValue)) {
    return `"${escapedValue}"`;
  }

  return escapedValue;
}

function formatCsvMoney(amountInReais: number): string {
  return amountInReais.toFixed(2).replace(".", ",");
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
