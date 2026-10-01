import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";

import type { SaleDetail } from "../application/sale-detail-repository";

type SaleDetailCardProps = {
  sale: SaleDetail;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function SaleDetailCard({ sale }: SaleDetailCardProps) {
  return (
    <Panel className="grid gap-5">
      {/* Resumo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
            {sale.eventName}
          </p>

          <h2 className="mt-2 text-2xl font-bold text-[var(--brand-foreground)]">
            {moneyFormatter.format(sale.totalInReais)}
          </h2>

          <p className="mt-1 text-sm text-[var(--brand-muted)]">
            {dateFormatter.format(sale.completedAt)}
          </p>
        </div>

        <StatusBadge tone={sale.status === "completed" ? "success" : "neutral"}>
          {sale.status === "completed" ? "Concluída" : "Cancelada"}
        </StatusBadge>
      </div>

      {/* Itens */}
      <section className="overflow-hidden rounded-xl border border-[var(--border)]">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <h3 className="text-sm font-bold text-[var(--brand-foreground)]">
            Itens da venda
          </h3>
        </div>

        <ul className="divide-y divide-[var(--border)]">
          {sale.items.map((item) => (
            <li
              className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              key={item.productId}
            >
              <div>
                <p className="text-sm font-bold text-[var(--brand-foreground)]">
                  {item.productName}
                </p>

                <p className="mt-1 text-sm text-[var(--brand-muted)]">
                  {item.quantity} ×{" "}
                  {moneyFormatter.format(item.unitPriceInReais)}
                </p>
              </div>

              <strong className="text-base font-bold text-[var(--brand-foreground)]">
                {moneyFormatter.format(item.totalInReais)}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      {/* Pagamento */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
          Pagamento
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <PaymentItem
            label="Método"
            value={formatPaymentMethod(sale.payment.method)}
          />

          <PaymentItem
            label="Valor recebido"
            value={moneyFormatter.format(sale.payment.amountInReais)}
          />

          <PaymentItem
            label="Troco"
            value={moneyFormatter.format(sale.payment.changeInReais)}
          />
        </dl>
      </section>
    </Panel>
  );
}

function PaymentItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <dt className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--brand-muted)]">
        {label}
      </dt>

      <dd className="mt-2 text-base font-bold text-[var(--brand-foreground)]">
        {value}
      </dd>
    </div>
  );
}

function formatPaymentMethod(method: SaleDetail["payment"]["method"]): string {
  const labels = {
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    pix: "Pix",
  } as const;

  return labels[method];
}
