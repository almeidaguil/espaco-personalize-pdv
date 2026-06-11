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

export function StockMovementsOverview({
  balances,
  movements,
}: StockMovementsOverviewProps) {
  return (
    <section className="grid gap-4">
      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              Saldos
            </p>
            <h2 className="mt-1 text-xl font-semibold">Estoque atual</h2>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {balances.length}
          </span>
        </div>

        {balances.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Nenhum produto com saldo registrado ainda.
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {balances.map((balance) => (
              <article
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
                key={balance.productId}
              >
                <p className="text-sm font-semibold text-slate-950">
                  {balance.productLabel}
                </p>
                <strong className="text-lg text-[#1e3275]">
                  {balance.quantityOnHand}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              Historico
            </p>
            <h2 className="mt-1 text-xl font-semibold">Movimentacoes</h2>
          </div>
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
            {movements.length}
          </span>
        </div>

        {movements.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Nenhuma movimentacao registrada ainda.
          </p>
        ) : (
          <div className="mt-4 grid gap-2">
            {movements.map((movement) => (
              <article
                className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
                key={movement.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {movement.productLabel}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {dateFormatter.format(movement.createdAt)}
                    </p>
                  </div>
                  <strong
                    className={
                      movement.quantityChange > 0
                        ? "text-lg text-emerald-700"
                        : "text-lg text-red-700"
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
      </section>
    </section>
  );
}

function formatMovementType(type: StockMovementSummaryItem["type"]): string {
  return type === "initial_adjustment" ? "Ajuste inicial" : "Ajuste manual";
}

function formatQuantityChange(quantityChange: number): string {
  return quantityChange > 0 ? `+${quantityChange}` : String(quantityChange);
}
