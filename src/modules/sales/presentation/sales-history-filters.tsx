import Link from "next/link";
import { Panel } from "@/shared/components/panel";
import type { SalesHistoryOptions } from "../application/sales-history-repository";

type FilterFields = {
  startDate?: string;
  endDate?: string;
  operatorId?: string;
  cashSessionId?: string;
  status?: string;
};
const fieldClass =
  "h-12 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)]";
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function SalesHistoryFilters({
  filters,
  options,
}: {
  filters: FilterFields;
  options: SalesHistoryOptions;
}) {
  return (
    <Panel as="form" action="/sales" method="get" className="grid gap-4">
      <p className="text-sm text-[var(--brand-muted)]">
        O período considera a data de abertura do caixa no fuso de São Paulo.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold">
          Data operacional inicial
          <input
            className={fieldClass}
            type="date"
            name="startDate"
            defaultValue={filters.startDate}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Data operacional final
          <input
            className={fieldClass}
            type="date"
            name="endDate"
            defaultValue={filters.endDate}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Operador
          <select
            className={fieldClass}
            name="operatorId"
            defaultValue={filters.operatorId ?? ""}
          >
            <option value="">Todos os operadores permitidos</option>
            {filters.operatorId &&
              !options.operators.some(
                (operator) => operator.id === filters.operatorId,
              ) && (
                <option value={filters.operatorId}>
                  Operador {filters.operatorId.slice(0, 8)}
                </option>
              )}
            {options.operators.map((operator) => (
              <option key={operator.id} value={operator.id}>
                {operator.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Sessão de caixa
          <select
            className={fieldClass}
            name="cashSessionId"
            defaultValue={filters.cashSessionId ?? ""}
          >
            <option value="">Todas as sessões permitidas</option>
            {filters.cashSessionId &&
              !options.sessions.some(
                (session) => session.id === filters.cashSessionId,
              ) && (
                <option value={filters.cashSessionId}>
                  Caixa {filters.cashSessionId.slice(0, 8)}
                </option>
              )}
            {options.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.operatorName} ·{" "}
                {dateFormatter.format(session.openedAt)} ·{" "}
                {session.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Status
          <select
            className={fieldClass}
            name="status"
            defaultValue={filters.status ?? ""}
          >
            <option value="">Todos os status</option>
            <option value="completed">Concluídas</option>
            <option value="canceled">Canceladas</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="min-h-11 rounded-xl bg-[var(--brand-accent)] px-5 font-semibold text-[var(--brand-primary)]"
          type="submit"
        >
          Filtrar
        </button>
        <Link
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] px-4 text-sm font-semibold"
          href="/sales"
        >
          Limpar filtros
        </Link>
      </div>
    </Panel>
  );
}
