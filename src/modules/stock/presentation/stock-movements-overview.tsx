"use client";

import { useMemo, useState } from "react";

import { PaginationControls } from "@/shared/components/pagination-controls";
import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";
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
    <section className="grid gap-5">
      {/* Saldos */}
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent-foreground)]">
              Saldos
            </p>

            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-[var(--brand-foreground)]">
              Estoque atual
            </h2>
          </div>

          <StatusBadge>{filteredBalances.length}</StatusBadge>
        </div>

        {balances.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-[var(--brand-muted)]">
            Nenhum produto com saldo registrado ainda.
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-2">
              <label
                className="text-sm font-semibold text-[var(--brand-foreground)]"
                htmlFor="stock-balance-search"
              >
                Buscar produto
              </label>

              <input
                className="h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
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
              <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--brand-muted)]">
                Nenhum saldo encontrado para esta busca.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {visibleBalances.map((balance) => (
                  <article
                    className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 transition hover:border-[var(--brand-accent)]/50"
                    key={balance.productId}
                  >
                    <p className="min-w-0 break-words text-sm font-semibold text-[var(--brand-foreground)]">
                      {balance.productLabel}
                    </p>

                    <strong className="shrink-0 text-lg font-bold text-[var(--brand-accent-foreground)]">
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

      {/* Histórico */}
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent-foreground)]">
              Histórico
            </p>

            <h2 className="mt-1.5 text-xl font-bold tracking-tight text-[var(--brand-foreground)]">
              Movimentações
            </h2>
          </div>

          <StatusBadge>{filteredMovements.length}</StatusBadge>
        </div>

        {movements.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-[var(--brand-muted)]">
            Nenhuma movimentação registrada ainda.
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-2">
              <label
                className="text-sm font-semibold text-[var(--brand-foreground)]"
                htmlFor="stock-movement-type"
              >
                Tipo de movimentação
              </label>

              <select
                className="h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
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
              <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--brand-muted)]">
                Nenhuma movimentação encontrada para este filtro.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {visibleMovements.map((movement) => (
                  <article
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
                    key={movement.id}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-[var(--brand-foreground)]">
                          {movement.productLabel}
                        </p>

                        <p className="mt-1 text-xs text-[var(--brand-muted)]">
                          {dateFormatter.format(movement.createdAt)}
                        </p>
                      </div>

                      <strong
                        className={
                          movement.quantityChange > 0
                            ? "shrink-0 text-lg font-bold text-emerald-700"
                            : "shrink-0 text-lg font-bold text-red-700"
                        }
                      >
                        {formatQuantityChange(movement.quantityChange)}
                      </strong>
                    </div>

                    <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
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
          itemLabel="movimentações"
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
