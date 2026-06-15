import Link from "next/link";

import type { SaleSummary } from "../application/sale-summary-repository";

type SalesListProps = {
  sales: SaleSummary[];
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function SalesList({ sales }: SalesListProps) {
  if (sales.length === 0) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
        Nenhuma venda registrada ainda.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-base font-semibold text-slate-950">
          Vendas registradas
        </h2>
      </div>
      <ul className="divide-y divide-slate-200">
        {sales.map((sale) => (
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
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                {sale.status === "completed" ? "Concluida" : "Cancelada"}
              </span>
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
    </section>
  );
}
