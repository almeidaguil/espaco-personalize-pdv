"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PaginationControls } from "@/shared/components/pagination-controls";
import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";
import { EmptyState } from "@/shared/components/status-state";

import type { SaleSummary } from "../application/sale-summary-repository";

type SalesListProps = {
  sales: SaleSummary[];
};

type SaleStatusFilter = SaleSummary["status"] | "all";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const pageSize = 8;

export function SalesList({ sales }: SalesListProps) {
  const [statusFilter, setStatusFilter] = useState<SaleStatusFilter>("all");

  const [currentPage, setCurrentPage] = useState(1);

  const filteredSales = useMemo(
    () => filterSalesByStatus(sales, statusFilter),
    [sales, statusFilter],
  );

  const visibleSales = filteredSales.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (sales.length === 0) {
    return (
      <EmptyState
        actions={[
          {
            href: "/pdv",
            label: "Ir ao PDV",
          },
        ]}
        eyebrow="Sem vendas"
        message="As vendas concluídas aparecerão aqui com status, valor e acesso aos detalhes."
        title="Nenhuma venda registrada ainda."
      />
    );
  }

  return (
    <section className="grid gap-5">
      {/* Filtros */}
      <Panel>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-2">
            <label
              className="text-sm font-semibold text-[var(--brand-foreground)]"
              htmlFor="sales-status-filter"
            >
              Status
            </label>

            <select
              className="h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
              id="sales-status-filter"
              onChange={(event) => {
                setStatusFilter(event.target.value as SaleStatusFilter);

                setCurrentPage(1);
              }}
              value={statusFilter}
            >
              <option value="all">Todos os status</option>

              <option value="completed">Concluídas</option>

              <option value="canceled">Canceladas</option>
            </select>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
              Resultados
            </p>

            <p className="mt-1 text-sm font-bold text-[var(--brand-foreground)]">
              {filteredSales.length}{" "}
              {filteredSales.length === 1 ? "venda" : "vendas"}
            </p>
          </div>
        </div>
      </Panel>

      {visibleSales.length === 0 ? (
        <EmptyState
          eyebrow="Sem vendas"
          message="Altere o filtro para consultar outros status de venda."
          title="Nenhuma venda encontrada para este filtro."
        />
      ) : (
        <Panel className="overflow-hidden" padding="none">
          {/* Cabeçalho */}
          <div className="flex flex-col gap-2 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent)]">
                Histórico
              </p>

              <h2 className="mt-1 text-lg font-bold text-[var(--brand-foreground)]">
                Vendas registradas
              </h2>
            </div>

            <span className="text-sm text-[var(--brand-muted)]">
              Página {currentPage}
            </span>
          </div>

          {/* Lista */}
          <ul className="divide-y divide-[var(--border)]">
            {visibleSales.map((sale) => (
              <li
                className="grid gap-4 px-5 py-5 transition hover:bg-[var(--surface-muted)]/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                key={sale.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--brand-foreground)]">
                      {sale.eventName}
                    </h3>

                    <StatusBadge
                      tone={sale.status === "completed" ? "success" : "neutral"}
                    >
                      {sale.status === "completed" ? "Concluída" : "Cancelada"}
                    </StatusBadge>
                  </div>

                  <p className="mt-2 text-sm text-[var(--brand-muted)]">
                    {dateFormatter.format(sale.completedAt)}
                  </p>

                  <strong className="mt-3 block text-xl font-bold text-[var(--brand-foreground)]">
                    {moneyFormatter.format(sale.totalInReais)}
                  </strong>
                </div>

                <Link
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[#9a7021] sm:w-auto"
                  href={`/sales/${sale.id}`}
                >
                  Ver detalhes
                </Link>
              </li>
            ))}
          </ul>

          {/* Paginação */}
          <div className="border-t border-[var(--border)] px-5 py-4">
            <PaginationControls
              currentPage={currentPage}
              itemLabel="vendas"
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              totalItems={filteredSales.length}
            />
          </div>
        </Panel>
      )}
    </section>
  );
}

function filterSalesByStatus(
  sales: SaleSummary[],
  statusFilter: SaleStatusFilter,
): SaleSummary[] {
  if (statusFilter === "all") {
    return sales;
  }

  return sales.filter((sale) => sale.status === statusFilter);
}
