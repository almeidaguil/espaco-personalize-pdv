"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { InlineFeedback } from "@/shared/components/inline-feedback";
import { PaginationControls } from "@/shared/components/pagination-controls";
import { Panel } from "@/shared/components/panel";

import type {
  SalesReport as SalesReportData,
  SalesReportFilters,
} from "../application/sales-report-repository";

type SalesReportProps = {
  errorMessage?: string;
  filters: SalesReportFilters;
  report: SalesReportData | null;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

export function SalesReport({
  errorMessage,
  filters,
  report,
}: SalesReportProps) {
  const router = useRouter();

  return (
    <section className="grid gap-5">
      <Panel as="form" action="/reports">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.5fr_auto] xl:items-end">
          <FilterField label="Data inicial" name="startDate">
            <input
              className={fieldClassName}
              defaultValue={filters.startDate}
              id="startDate"
              name="startDate"
              required
              type="date"
            />
          </FilterField>

          <FilterField label="Data final" name="endDate">
            <input
              className={fieldClassName}
              defaultValue={filters.endDate}
              id="endDate"
              name="endDate"
              required
              type="date"
            />
          </FilterField>

          <FilterField label="Vendedor" name="operatorId">
            <select
              className={fieldClassName}
              defaultValue={filters.operatorId ?? ""}
              id="operatorId"
              name="operatorId"
            >
              <option value="">Todos os vendedores permitidos</option>
              {report?.operatorOptions.map((operator) => (
                <option key={operator.id} value={operator.id}>
                  {operator.name}
                </option>
              ))}
            </select>
          </FilterField>

          <FilterField label="Sessão de caixa" name="cashSessionId">
            <select
              className={fieldClassName}
              defaultValue={filters.cashSessionId ?? ""}
              id="cashSessionId"
              name="cashSessionId"
            >
              <option value="">Todas as sessões permitidas</option>
              {report?.cashSessionOptions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.operatorName} ·{" "}
                  {formatBusinessDate(session.businessDate)} ·{" "}
                  {timeFormatter.format(new Date(session.openedAt))}
                </option>
              ))}
            </select>
          </FilterField>

          <button
            className="h-12 w-full rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-5 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 xl:w-auto"
            type="submit"
          >
            Aplicar filtros
          </button>
        </div>
      </Panel>

      {!report ? (
        <InlineFeedback padding="md" tone="error">
          {errorMessage ??
            "Não foi possível carregar o relatório com os filtros informados."}
        </InlineFeedback>
      ) : (
        <>
          <Panel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
                  Período operacional
                </p>
                <h2 className="mt-1.5 text-xl font-bold text-[var(--brand-foreground)]">
                  {formatBusinessDate(report.startDate)} a{" "}
                  {formatBusinessDate(report.endDate)}
                </h2>
              </div>

              <Link
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)] sm:w-auto"
                href={`/reports/export?${buildExportQuery(filters)}`}
              >
                Exportar CSV
              </Link>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <SummaryCard
                highlight
                label="Receita líquida"
                value={formatMoney(report.netRevenueInCents)}
              />
              <SummaryCard
                label="Vendas reconhecidas"
                tone="success"
                value={`${report.completedSalesCount} (${formatMoney(report.completedTotalInCents)})`}
              />
              <SummaryCard
                label="Vendas canceladas"
                tone="danger"
                value={`${report.canceledSalesCount} (${formatMoney(report.canceledTotalInCents)})`}
              />
              <SummaryCard
                label="Ajustes pós-fechamento"
                tone="danger"
                value={`${report.postCloseAdjustmentsCount} (${formatMoney(report.postCloseAdjustmentsTotalInCents)})`}
              />
              <SummaryCard
                label="Sessões de caixa"
                value={String(report.sessionsTotalCount)}
              />
            </dl>
          </Panel>

          <Panel>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
              Reconciliação
            </p>
            <h2 className="mt-1 text-lg font-bold text-[var(--brand-foreground)]">
              Divergências dos caixas fechados
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Faltas"
                tone="danger"
                value={formatMoney(report.cashShortageTotalInCents)}
              />
              <SummaryCard
                label="Sobras"
                tone="success"
                value={formatMoney(report.cashSurplusTotalInCents)}
              />
              <SummaryCard
                label="Diferença líquida"
                value={formatMoney(report.cashDifferenceTotalInCents)}
              />
            </dl>
          </Panel>

          <Panel>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
              Financeiro
            </p>
            <h2 className="mt-1 text-lg font-bold text-[var(--brand-foreground)]">
              Resumo por pagamento
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {report.paymentSummary.map((payment) => (
                <SummaryCard
                  key={payment.method}
                  label={formatPaymentMethod(payment.method)}
                  value={`${formatMoney(payment.netTotalInCents)} · ${payment.salesCount} ${payment.salesCount === 1 ? "venda" : "vendas"}`}
                />
              ))}
            </dl>
          </Panel>

          {report.postCloseAdjustmentsCount > 0 ? (
            <Panel>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
                Ajustes financeiros
              </p>
              <h2 className="mt-1 text-lg font-bold text-[var(--brand-foreground)]">
                Cancelamentos após fechamento
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                Estes valores pertencem à data do cancelamento e não alteram a
                conferência já registrada no fechamento do caixa.
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.postCloseAdjustmentPaymentSummary.map((payment) => (
                  <SummaryCard
                    key={payment.method}
                    label={formatPaymentMethod(payment.method)}
                    value={`${formatMoney(payment.netTotalInCents)} · ${payment.salesCount} ${payment.salesCount === 1 ? "ajuste" : "ajustes"}`}
                  />
                ))}
              </dl>
            </Panel>
          ) : null}

          <Panel className="overflow-hidden" padding="none">
            <SectionHeader eyebrow="Operação" title="Sessões de caixa" />
            {report.sessionsTotalCount === 0 ? (
              <EmptyState>Nenhuma sessão encontrada neste período.</EmptyState>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)]">
                  {report.sessions.map((session) => (
                    <li
                      className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_auto] lg:items-center"
                      key={session.id}
                    >
                      <div>
                        <p className="text-sm font-bold text-[var(--brand-foreground)]">
                          {session.operatorName} ·{" "}
                          {formatBusinessDate(session.businessDate)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--brand-muted)]">
                          {session.status === "open" ? "Aberto" : "Fechado"} às{" "}
                          {timeFormatter.format(
                            new Date(
                              session.status === "closed" && session.closedAt
                                ? session.closedAt
                                : session.openedAt,
                            ),
                          )}{" "}
                          · {session.completedSalesCount} vendas concluídas
                        </p>
                      </div>
                      <div className="text-left lg:text-right">
                        <strong className="text-base text-[var(--brand-foreground)]">
                          {formatMoney(session.completedTotalInCents)}
                        </strong>
                        <p className="mt-1 text-sm text-[var(--brand-muted)]">
                          {session.differenceAmountInCents === null
                            ? "Reconciliação pendente"
                            : `Diferença: ${formatMoney(session.differenceAmountInCents)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <PaginationFooter
                  currentPage={report.sessionsPage}
                  itemLabel="caixas"
                  onPageChange={(page) =>
                    router.push(
                      `/reports?${buildReportQuery(filters, {
                        itemsPage: report.itemsPage,
                        sessionsPage: page,
                      })}`,
                    )
                  }
                  pageSize={report.pageSize}
                  totalItems={report.sessionsTotalCount}
                />
              </>
            )}
          </Panel>

          <Panel className="overflow-hidden" padding="none">
            <SectionHeader eyebrow="Produtos" title="Itens vendidos" />
            {report.itemsTotalCount === 0 ? (
              <EmptyState>Nenhum item vendido neste período.</EmptyState>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)]">
                  {report.items.map((item) => (
                    <li
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
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
                      <strong className="text-base text-[var(--brand-foreground)]">
                        {formatMoney(item.grossTotalInCents)}
                      </strong>
                    </li>
                  ))}
                </ul>
                <PaginationFooter
                  currentPage={report.itemsPage}
                  itemLabel="itens"
                  onPageChange={(page) =>
                    router.push(
                      `/reports?${buildReportQuery(filters, {
                        itemsPage: page,
                        sessionsPage: report.sessionsPage,
                      })}`,
                    )
                  }
                  pageSize={report.pageSize}
                  totalItems={report.itemsTotalCount}
                />
              </>
            )}
          </Panel>
        </>
      )}
    </section>
  );
}

const fieldClassName =
  "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15";

function FilterField({
  children,
  label,
  name,
}: {
  children: React.ReactNode;
  label: string;
  name: string;
}) {
  return (
    <div className="grid gap-2">
      <label
        className="text-sm font-semibold text-[var(--brand-foreground)]"
        htmlFor={name}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({
  highlight = false,
  label,
  tone = "default",
  value,
}: {
  highlight?: boolean;
  label: string;
  tone?: "default" | "success" | "danger";
  value: string;
}) {
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

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-b border-[var(--border)] px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-bold text-[var(--brand-foreground)]">
        {title}
      </h2>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="p-5 text-sm leading-6 text-[var(--brand-muted)]">
      {children}
    </p>
  );
}

function PaginationFooter({
  currentPage,
  itemLabel,
  onPageChange,
  pageSize,
  totalItems,
}: {
  currentPage: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
}) {
  return (
    <div className="border-t border-[var(--border)] px-5 py-4">
      <PaginationControls
        currentPage={currentPage}
        itemLabel={itemLabel}
        onPageChange={onPageChange}
        pageSize={pageSize}
        totalItems={totalItems}
      />
    </div>
  );
}

function formatMoney(amountInCents: number): string {
  return moneyFormatter.format(amountInCents / 100);
}

function formatBusinessDate(value: string): string {
  return dateFormatter.format(new Date(`${value}T12:00:00-03:00`));
}

function formatPaymentMethod(
  method: SalesReportData["paymentSummary"][number]["method"],
): string {
  return {
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    pix: "Pix",
  }[method];
}

function buildExportQuery(filters: SalesReportFilters): string {
  const parameters = new URLSearchParams({
    endDate: filters.endDate,
    startDate: filters.startDate,
  });
  if (filters.operatorId) parameters.set("operatorId", filters.operatorId);
  if (filters.cashSessionId)
    parameters.set("cashSessionId", filters.cashSessionId);
  return parameters.toString();
}

function buildReportQuery(
  filters: SalesReportFilters,
  pagination: { itemsPage: number; sessionsPage: number },
): string {
  const parameters = new URLSearchParams({
    endDate: filters.endDate,
    itemsPage: String(pagination.itemsPage),
    sessionsPage: String(pagination.sessionsPage),
    startDate: filters.startDate,
  });
  if (filters.operatorId) parameters.set("operatorId", filters.operatorId);
  if (filters.cashSessionId)
    parameters.set("cashSessionId", filters.cashSessionId);
  return parameters.toString();
}
