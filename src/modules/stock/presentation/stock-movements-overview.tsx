"use client";

import { useMemo, useState } from "react";

import { PaginationControls } from "@/shared/components/pagination-controls";
import { Panel } from "@/shared/components/panel";
import { normalizeSearchTerm } from "@/shared/utils/search";

import type {
  StockMovementSummaryItem,
  StockProductBalanceSummary,
} from "../application/list-stock-movements-summary-use-case";

type StockMovementsOverviewProps = {
  balances: StockProductBalanceSummary[];
  movements: StockMovementSummaryItem[];
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const balancesPageSize = 8;
const movementsPageSize = 8;
const movementTypeLabels: Record<StockMovementSummaryItem["type"], string> = {
  initial_adjustment: "Ajuste inicial",
  manual_adjustment: "Ajuste manual",
  sale: "Venda",
  sale_cancellation: "Cancelamento de venda",
};

export function StockMovementsOverview({
  balances,
  movements,
}: StockMovementsOverviewProps) {
  const [balancesPage, setBalancesPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
  const [balanceSearchTerm, setBalanceSearchTerm] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<
    StockMovementSummaryItem["type"] | "all"
  >("all");
  const filteredBalances = useMemo(
    () => filterBalances(balances, balanceSearchTerm),
    [balanceSearchTerm, balances],
  );
  const filteredMovements = useMemo(
    () => filterMovements(movements, movementTypeFilter),
    [movementTypeFilter, movements],
  );
  const visibleBalances = filteredBalances.slice(
    (balancesPage - 1) * balancesPageSize,
    balancesPage * balancesPageSize,
  );
  const visibleMovements = filteredMovements.slice(
    (movementsPage - 1) * movementsPageSize,
    movementsPage * movementsPageSize,
  );

  return (
    <section className="grid gap-4">
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              Saldos
            </p>
            <h2 className="mt-1 text-xl font-semibold">Estoque atual</h2>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {filteredBalances.length}
          </span>
        </div>

        {balances.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Nenhum produto com saldo registrado ainda.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="stock-balance-search"
              >
                Buscar produto
              </label>
              <input
                className="h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
                id="stock-balance-search"
                onChange={(event) => {
                  setBalanceSearchTerm(event.target.value);
                  setBalancesPage(1);
                }}
                placeholder="Nome ou SKU"
                type="search"
                value={balanceSearchTerm}
              />
            </div>

            {visibleBalances.length === 0 ? (
              <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Nenhum saldo encontrado para esta busca.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {visibleBalances.map((balance) => (
                  <article
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
                    key={balance.productId}
                  >
                    <p className="min-w-0 break-words text-sm font-semibold text-slate-950">
                      {balance.productLabel}
                    </p>
                    <strong className="shrink-0 text-lg text-[#1e3275]">
                      {balance.quantityOnHand}
                    </strong>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        <PaginationControls
          currentPage={balancesPage}
          itemLabel="produtos"
          onPageChange={setBalancesPage}
          pageSize={balancesPageSize}
          totalItems={filteredBalances.length}
        />
      </Panel>

      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              Historico
            </p>
            <h2 className="mt-1 text-xl font-semibold">Movimentacoes</h2>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {filteredMovements.length}
          </span>
        </div>

        {movements.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Nenhuma movimentacao registrada ainda.
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="stock-movement-type"
              >
                Tipo de movimentacao
              </label>
              <select
                className="h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
                id="stock-movement-type"
                onChange={(event) => {
                  setMovementTypeFilter(
                    event.target.value as
                      | StockMovementSummaryItem["type"]
                      | "all",
                  );
                  setMovementsPage(1);
                }}
                value={movementTypeFilter}
              >
                <option value="all">Todos os tipos</option>
                {Object.entries(movementTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {visibleMovements.length === 0 ? (
              <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Nenhuma movimentacao encontrada para este filtro.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {visibleMovements.map((movement) => (
                  <article
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
                    key={movement.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-slate-950">
                          {movement.productLabel}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {dateFormatter.format(movement.createdAt)}
                        </p>
                      </div>
                      <strong
                        className={
                          movement.quantityChange > 0
                            ? "shrink-0 text-lg text-emerald-700"
                            : "shrink-0 text-lg text-red-700"
                        }
                      >
                        {formatQuantityChange(movement.quantityChange)}
                      </strong>
                    </div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {formatMovementType(movement.type)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
        <PaginationControls
          currentPage={movementsPage}
          itemLabel="movimentacoes"
          onPageChange={setMovementsPage}
          pageSize={movementsPageSize}
          totalItems={filteredMovements.length}
        />
      </Panel>
    </section>
  );
}

function formatMovementType(type: StockMovementSummaryItem["type"]): string {
  return movementTypeLabels[type];
}

function formatQuantityChange(quantityChange: number): string {
  return quantityChange > 0 ? `+${quantityChange}` : String(quantityChange);
}

function filterBalances(
  balances: StockProductBalanceSummary[],
  searchTerm: string,
): StockProductBalanceSummary[] {
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);

  if (!normalizedSearchTerm) {
    return balances;
  }

  return balances.filter((balance) =>
    normalizeSearchTerm(balance.productLabel).includes(normalizedSearchTerm),
  );
}

function filterMovements(
  movements: StockMovementSummaryItem[],
  typeFilter: StockMovementSummaryItem["type"] | "all",
): StockMovementSummaryItem[] {
  if (typeFilter === "all") {
    return movements;
  }

  return movements.filter((movement) => movement.type === typeFilter);
}
