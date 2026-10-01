"use client";

import Link from "next/link";
import { useState } from "react";

import type { Event } from "@/modules/events/domain/event";
import { InlineFeedback } from "@/shared/components/inline-feedback";
import { PaginationControls } from "@/shared/components/pagination-controls";
import { Panel } from "@/shared/components/panel";

import type { SalesByEventReport } from "../application/sales-by-event-report-repository";

type SalesByEventReportProps = {
  events: Event[];
  report: SalesByEventReport | null;
  selectedEventId: string;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const itemsPageSize = 8;

export function SalesByEventReport({
  events,
  report,
  selectedEventId,
}: SalesByEventReportProps) {
  const [itemsPage, setItemsPage] = useState(1);

  if (events.length === 0) {
    return (
      <Panel className="text-sm leading-6 text-[var(--brand-muted)]">
        Cadastre um evento para gerar relatórios de vendas.
      </Panel>
    );
  }

  const visibleItems = report
    ? report.items.slice(
        (itemsPage - 1) * itemsPageSize,
        itemsPage * itemsPageSize,
      )
    : [];

  return (
    <section className="grid gap-5">
      {/* Filtro */}
      <Panel as="form" action="/reports">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-2">
            <label
              className="text-sm font-semibold text-[var(--brand-foreground)]"
              htmlFor="eventId"
            >
              Evento
            </label>

            <select
              className="h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
              defaultValue={selectedEventId}
              id="eventId"
              name="eventId"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} · {dateFormatter.format(event.startsAt)}
                </option>
              ))}
            </select>
          </div>

          <button
            className="h-12 w-full rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-5 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 sm:w-auto"
            type="submit"
          >
            Gerar relatório
          </button>
        </div>
      </Panel>

      {!report ? (
        <InlineFeedback padding="md" tone="error">
          Não foi possível carregar o relatório deste evento.
        </InlineFeedback>
      ) : (
        <>
          {/* Resumo geral */}
          <Panel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
                  Relatório por evento
                </p>

                <h2 className="mt-1.5 text-xl font-bold text-[var(--brand-foreground)]">
                  {report.eventName}
                </h2>
              </div>

              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)] sm:w-auto"
                href={`/reports/export?eventId=${report.eventId}`}
              >
                Exportar CSV
              </Link>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-3">
              <SummaryCard
                highlight
                label="Total bruto"
                value={moneyFormatter.format(report.grossTotalInReais)}
              />

              <SummaryCard
                label="Vendas concluídas"
                tone="success"
                value={String(report.completedSalesCount)}
              />

              <SummaryCard
                label="Vendas canceladas"
                tone="danger"
                value={`${report.canceledSalesCount} (${moneyFormatter.format(
                  report.canceledTotalInReais,
                )})`}
              />
            </dl>
          </Panel>

          {/* Pagamentos */}
          <Panel>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
                Financeiro
              </p>

              <h2 className="mt-1 text-lg font-bold text-[var(--brand-foreground)]">
                Resumo por pagamento
              </h2>
            </div>

            {report.paymentSummary.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--brand-muted)]">
                Nenhum pagamento registrado neste evento.
              </p>
            ) : (
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.paymentSummary.map((payment) => (
                  <SummaryCard
                    key={payment.method}
                    label={formatPaymentMethod(payment.method)}
                    value={`${moneyFormatter.format(
                      payment.netTotalInReais,
                    )} · ${payment.salesCount} ${
                      payment.salesCount === 1 ? "venda" : "vendas"
                    }`}
                  />
                ))}
              </dl>
            )}
          </Panel>

          {/* Itens */}
          <Panel className="overflow-hidden" padding="none">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
                Produtos
              </p>

              <h2 className="mt-1 text-lg font-bold text-[var(--brand-foreground)]">
                Itens vendidos
              </h2>
            </div>

            {report.items.length === 0 ? (
              <p className="p-5 text-sm leading-6 text-[var(--brand-muted)]">
                Nenhum item vendido neste evento.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)]">
                  {visibleItems.map((item) => (
                    <li
                      className="grid gap-3 px-5 py-4 transition hover:bg-[var(--surface-muted)]/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                      key={item.productId}
                    >
                      <div>
                        <p className="text-sm font-bold text-[var(--brand-foreground)]">
                          {item.productName}
                        </p>

                        <p className="mt-1 text-sm text-[var(--brand-muted)]">
                          {item.quantity}{" "}
                          {item.quantity === 1 ? "unidade" : "unidades"}
                        </p>
                      </div>

                      <strong className="text-base font-bold text-[var(--brand-foreground)]">
                        {moneyFormatter.format(item.grossTotalInReais)}
                      </strong>
                    </li>
                  ))}
                </ul>

                <div className="border-t border-[var(--border)] px-5 py-4">
                  <PaginationControls
                    currentPage={itemsPage}
                    itemLabel="itens"
                    onPageChange={setItemsPage}
                    pageSize={itemsPageSize}
                    totalItems={report.items.length}
                  />
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </section>
  );
}

type SummaryCardProps = {
  highlight?: boolean;
  label: string;
  tone?: "default" | "success" | "danger";
  value: string;
};

function SummaryCard({
  highlight = false,
  label,
  tone = "default",
  value,
}: SummaryCardProps) {
  const valueClassName =
    tone === "success"
      ? "text-emerald-700"
      : tone === "danger"
        ? "text-red-700"
        : "text-[var(--brand-foreground)]";

  return (
    <div
      className={
        highlight
          ? "rounded-xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/[0.07] p-4"
          : "rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
      }
    >
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
        {label}
      </dt>

      <dd className={`mt-2 text-lg font-bold ${valueClassName}`}>{value}</dd>
    </div>
  );
}

function formatPaymentMethod(
  method: SalesByEventReport["paymentSummary"][number]["method"],
): string {
  const labels = {
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    pix: "Pix",
  } as const;

  return labels[method];
}
