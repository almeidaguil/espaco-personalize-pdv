import Link from "next/link";
import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";
import { EmptyState } from "@/shared/components/status-state";
import type { SaleSummary } from "../application/sale-summary-repository";
import type { SalesHistoryFilters } from "../application/sales-history-repository";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const linkClass =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] hover:border-[var(--brand-accent)]";

export function SalesList({
  sales,
  totalCount,
  filters,
}: {
  sales: SaleSummary[];
  totalCount: number;
  filters: SalesHistoryFilters;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--brand-muted)]">
        <p>
          {totalCount} {totalCount === 1 ? "venda" : "vendas"}
        </p>
        <p>
          Página {filters.page} de {totalPages}
        </p>
      </div>
      {sales.length === 0 ? (
        <EmptyState
          eyebrow="Sem vendas"
          title="Nenhuma venda encontrada para estes filtros."
          message="Altere os filtros para consultar o histórico de vendas."
        />
      ) : (
        <Panel padding="none" className="overflow-hidden">
          <ul className="divide-y divide-[var(--border)]">
            {sales.map((sale) => (
              <li
                key={sale.id}
                className="grid gap-4 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--brand-foreground)]">
                      Venda #{sale.id.slice(0, 8)}
                    </h2>
                    <StatusBadge
                      tone={sale.status === "completed" ? "success" : "neutral"}
                    >
                      {sale.status === "completed" ? "Concluída" : "Cancelada"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 font-semibold">{sale.operatorName}</p>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">
                    Caixa {sale.cashSessionId.slice(0, 8)}
                    {sale.cashSessionOpenedAt
                      ? ` · Aberto em ${dateFormatter.format(sale.cashSessionOpenedAt)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">
                    Venda em {dateFormatter.format(sale.completedAt)}
                  </p>
                  <strong className="mt-3 block text-xl font-bold">
                    {moneyFormatter.format(sale.totalInReais)}
                  </strong>
                </div>
                <Link className={linkClass} href={`/sales/${sale.id}`}>
                  Ver detalhes
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <nav
        aria-label="Paginação de vendas"
        className="flex justify-between gap-3"
      >
        {filters.page > 1 ? (
          <Link
            className={linkClass}
            href={pageHref(filters, filters.page - 1)}
          >
            Anterior
          </Link>
        ) : (
          <span />
        )}
        {filters.page < totalPages && (
          <Link
            className={linkClass}
            href={pageHref(filters, filters.page + 1)}
          >
            Próxima
          </Link>
        )}
      </nav>
    </section>
  );
}

function pageHref(filters: SalesHistoryFilters, page: number): string {
  const params = new URLSearchParams();
  for (const key of [
    "startDate",
    "endDate",
    "operatorId",
    "cashSessionId",
    "status",
  ] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  params.set("page", String(page));
  return `/sales?${params.toString()}`;
}
