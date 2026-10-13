import type { SalesReport } from "./sales-report-repository";

export type ExportSalesReportCsvInput = {
  report: SalesReport;
};

export type ExportSalesReportCsvResult = {
  content: string;
  filename: string;
  mimeType: "text/csv; charset=utf-8";
};

export function exportSalesReportCsvUseCase({
  report,
}: ExportSalesReportCsvInput): ExportSalesReportCsvResult {
  const rows = [
    ["Seção", "Identificador", "Detalhe", "Quantidade", "Valor em reais"],
    [
      "Resumo",
      "receita_liquida",
      "Receita líquida após ajustes pós-fechamento",
      "",
      formatCsvMoney(report.netRevenueInCents),
    ],
    [
      "Resumo",
      "vendas_concluidas",
      "Vendas concluídas",
      String(report.completedSalesCount),
      formatCsvMoney(report.completedTotalInCents),
    ],
    [
      "Resumo",
      "vendas_canceladas",
      "Vendas canceladas (fora da receita)",
      String(report.canceledSalesCount),
      formatCsvMoney(report.canceledTotalInCents),
    ],
    [
      "Resumo",
      "ajustes_pos_fechamento",
      "Cancelamentos ajustados após o fechamento",
      String(report.postCloseAdjustmentsCount),
      formatCsvMoney(report.postCloseAdjustmentsTotalInCents),
    ],
    [
      "Resumo",
      "falta_caixa",
      "Falta apurada em caixas fechados",
      "",
      formatCsvMoney(report.cashShortageTotalInCents),
    ],
    [
      "Resumo",
      "sobra_caixa",
      "Sobra apurada em caixas fechados",
      "",
      formatCsvMoney(report.cashSurplusTotalInCents),
    ],
    [
      "Resumo",
      "diferenca_liquida_caixa",
      "Diferença líquida dos caixas fechados",
      "",
      formatCsvMoney(report.cashDifferenceTotalInCents),
    ],
    ...report.paymentSummary.map((payment) => [
      "Pagamento",
      payment.method,
      formatPaymentMethod(payment.method),
      String(payment.salesCount),
      formatCsvMoney(payment.netTotalInCents),
    ]),
    ...report.postCloseAdjustmentPaymentSummary.map((payment) => [
      "Ajuste pós-fechamento",
      payment.method,
      formatPaymentMethod(payment.method),
      String(payment.salesCount),
      formatCsvMoney(payment.netTotalInCents),
    ]),
    ...report.items.map((item) => [
      "Produto",
      item.productId,
      item.productName,
      String(item.quantity),
      formatCsvMoney(item.grossTotalInCents),
    ]),
    ...report.sessions.flatMap((session) => [
      [
        "Caixa",
        session.id,
        `${session.operatorName} · ${session.businessDate} · ${formatCashSessionStatus(session.status)}`,
        String(session.completedSalesCount),
        formatCsvMoney(session.completedTotalInCents),
      ],
      [
        "Divergência de caixa",
        session.id,
        session.status === "closed"
          ? session.operatorName
          : "Fechamento pendente",
        "",
        session.differenceAmountInCents === null
          ? ""
          : formatCsvMoney(session.differenceAmountInCents),
      ],
    ]),
  ];

  return {
    content: rows.map(toCsvRow).join("\n"),
    filename: `relatorio-vendas-${report.startDate}-a-${report.endDate}.csv`,
    mimeType: "text/csv; charset=utf-8",
  };
}

function toCsvRow(values: string[]): string {
  return values
    .map((value, index) => escapeCsvValue(value, index < 3))
    .join(";");
}

function escapeCsvValue(value: string, isUntrustedText: boolean): string {
  const safeValue = isUntrustedText
    ? neutralizeSpreadsheetFormula(value)
    : value;
  const escapedValue = safeValue.replaceAll('"', '""');

  if (/[;"\n\r]/.test(escapedValue)) {
    return `"${escapedValue}"`;
  }

  return escapedValue;
}

function neutralizeSpreadsheetFormula(value: string): string {
  if (/^\s*[=+\-@]/u.test(value)) {
    return `'${value}`;
  }

  return value;
}

function formatCsvMoney(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2).replace(".", ",");
}

function formatPaymentMethod(
  method: SalesReport["paymentSummary"][number]["method"],
): string {
  const labels = {
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    pix: "Pix",
  } as const;

  return labels[method];
}

function formatCashSessionStatus(
  status: SalesReport["sessions"][number]["status"],
): string {
  return status === "open" ? "Aberto" : "Fechado";
}
