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
      <Panel className="text-sm leading-6 text-slate-600">
        Cadastre um evento para gerar relatorios de vendas.
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
    <section className="grid gap-4">
      <Panel as="form" action="/reports" padding="sm">
        <label
          className="text-sm font-semibold text-slate-800"
          htmlFor="eventId"
        >
          Evento
        </label>
        <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto]">
          <select
            className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            defaultValue={selectedEventId}
            id="eventId"
            name="eventId"
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} - {dateFormatter.format(event.startsAt)}
              </option>
            ))}
          </select>
          <button className="min-h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#142456]">
            Gerar relatorio
          </button>
        </div>
      </Panel>

      {!report ? (
        <InlineFeedback padding="md" tone="error">
          Nao foi possivel carregar o relatorio deste evento.
        </InlineFeedback>
      ) : (
        <>
          <Panel padding="sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
                  Relatorio por evento
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-950">
                  {report.eventName}
                </h2>
              </div>
              <Link
                className="rounded-md border border-[#1e3275] px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:bg-[#1e3275] hover:text-white"
                href={`/reports/export?eventId=${report.eventId}`}
              >
                Exportar CSV
              </Link>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Total bruto"
                value={moneyFormatter.format(report.grossTotalInReais)}
              />
              <SummaryCard
                label="Vendas concluidas"
                value={String(report.completedSalesCount)}
              />
              <SummaryCard
                label="Vendas canceladas"
                value={`${report.canceledSalesCount} (${moneyFormatter.format(
                  report.canceledTotalInReais,
                )})`}
              />
            </dl>
          </Panel>

          <Panel padding="sm">
            <h2 className="text-base font-semibold text-slate-950">
              Resumo por pagamento
            </h2>
            <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {report.paymentSummary.map((payment) => (
                <SummaryCard
                  key={payment.method}
                  label={formatPaymentMethod(payment.method)}
                  value={`${moneyFormatter.format(payment.netTotalInReais)} (${payment.salesCount})`}
                />
              ))}
            </dl>
          </Panel>

          <Panel className="overflow-hidden" padding="none">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-950">
                Itens vendidos
              </h2>
            </div>
            {report.items.length === 0 ? (
              <p className="p-4 text-sm leading-6 text-slate-600">
                Nenhum item vendido neste evento.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-slate-200">
                  {visibleItems.map((item) => (
                    <li
                      className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto]"
                      key={item.productId}
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-950">
                          {item.productName}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {item.quantity} unidade(s)
                        </p>
                      </div>
                      <strong className="text-base text-slate-950">
                        {moneyFormatter.format(item.grossTotalInReais)}
                      </strong>
                    </li>
                  ))}
                </ul>
                <div className="px-4 pb-4">
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function formatPaymentMethod(
  method: SalesByEventReport["paymentSummary"][number]["method"],
): string {
  const labels = {
    cash: "Dinheiro",
    credit_card: "Cartao de credito",
    debit_card: "Cartao de debito",
    pix: "Pix",
  } as const;

  return labels[method];
}
