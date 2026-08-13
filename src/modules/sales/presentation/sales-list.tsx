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
        actions={[{ href: "/pdv", label: "Ir ao PDV" }]}
        eyebrow="Sem vendas"
        message="As vendas concluidas aparecerao aqui com status, total e acesso aos detalhes."
        title="Nenhuma venda registrada ainda."
      />
    );
  }

  return (
    <section className="grid gap-4">
      <Panel padding="sm">
        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="sales-status-filter"
          >
            Status
          </label>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="sales-status-filter"
            onChange={(event) => {
              setStatusFilter(event.target.value as SaleStatusFilter);
              setCurrentPage(1);
            }}
            value={statusFilter}
          >
            <option value="all">Todos os status</option>
            <option value="completed">Concluidas</option>
            <option value="canceled">Canceladas</option>
          </select>
          <p className="text-xs text-slate-500">
            {filteredSales.length} venda(s) encontrada(s)
          </p>
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
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-950">
              Vendas registradas
            </h2>
          </div>
          <ul className="divide-y divide-slate-200">
            {visibleSales.map((sale) => (
              <li className="grid gap-3 px-4 py-4" key={sale.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {sale.eventName}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {dateFormatter.format(sale.completedAt)}
                    </p>
                  </div>
                  <StatusBadge
                    tone={sale.status === "completed" ? "success" : "neutral"}
                  >
                    {sale.status === "completed" ? "Concluida" : "Cancelada"}
                  </StatusBadge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-lg text-slate-950">
                    {moneyFormatter.format(sale.totalInReais)}
                  </strong>
                  <Link
                    className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275]"
                    href={`/sales/${sale.id}`}
                  >
                    Ver detalhes
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <div className="px-4 pb-4">
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
