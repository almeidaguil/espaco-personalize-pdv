import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";

import type { SaleDetail } from "../application/sale-detail-repository";
import type { Payment } from "../domain/sale";

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
  timeZone: "America/Sao_Paulo",
});

export function SaleDetailCard({ sale }: SaleDetailCardProps) {
  return (
    <Panel className="grid gap-5">
      {/* Resumo */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand-accent-foreground)]">
            Venda #{sale.id.slice(0, 8)}
          </p>

          <p className="mt-2 text-sm font-semibold text-[var(--brand-muted)]">
            Total líquido
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--brand-foreground)]">
            {moneyFormatter.format(sale.totalInCents / 100)}
          </h2>

          <p className="mt-1 text-sm text-[var(--brand-muted)]">
            {dateFormatter.format(sale.completedAt)}
          </p>
        </div>

        <StatusBadge tone={sale.status === "completed" ? "success" : "neutral"}>
          {sale.status === "completed" ? "Concluída" : "Cancelada"}
        </StatusBadge>
      </div>

      <dl className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 sm:grid-cols-2">
        <PaymentItem
          label="Subtotal"
          value={moneyFormatter.format(sale.subtotalInCents / 100)}
        />
        <PaymentItem
          label="Desconto"
          value={moneyFormatter.format(sale.discountInCents / 100)}
        />
      </dl>

      {sale.discountInCents > 0 ? (
        <p className="rounded-xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-4 py-3 text-sm font-semibold text-[var(--brand-accent-foreground)]">
          Desconto concedido por {sale.operatorName}
        </p>
      ) : null}

      <dl className="grid gap-4 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-2">
        <PaymentItem label="Operador" value={sale.operatorName} />
        <PaymentItem
          label="Identificador do operador"
          value={sale.operatorId}
        />
        <PaymentItem label="Sessão de caixa" value={sale.cashSessionId} />
        <PaymentItem
          label="Abertura do caixa"
          value={
            sale.cashSessionOpenedAt
              ? dateFormatter.format(sale.cashSessionOpenedAt)
              : "Não disponível"
          }
        />
        <PaymentItem
          label="Data operacional"
          value={
            sale.businessDate
              ? sale.businessDate.split("-").reverse().join("/")
              : "Não disponível"
          }
        />
        <PaymentItem label="Identificador da venda" value={sale.id} />
      </dl>

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
                  {moneyFormatter.format(item.unitPriceInCents / 100)}
                </p>
              </div>

              <strong className="text-base font-bold text-[var(--brand-foreground)]">
                {moneyFormatter.format(item.totalInCents / 100)}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      {/* Pagamentos */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-accent-foreground)]">
          Pagamentos
        </p>

        <ul className="mt-4 grid gap-3">
          {sale.payments.map((payment) => (
            <li
              className="rounded-xl border border-[var(--border)] bg-white p-4"
              key={payment.method}
            >
              <h3 className="text-base font-bold text-[var(--brand-foreground)]">
                {formatPaymentMethod(payment.method)}
              </h3>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PaymentItem
                  label="Valor recebido"
                  value={moneyFormatter.format(payment.amountInCents / 100)}
                />
                <PaymentItem
                  label="Contribuição líquida"
                  value={moneyFormatter.format(
                    (payment.amountInCents - payment.changeInCents) / 100,
                  )}
                />
                {payment.method === "cash" ? (
                  <PaymentItem
                    label="Troco"
                    value={moneyFormatter.format(payment.changeInCents / 100)}
                  />
                ) : null}
                {payment.method === "credit_card" ? (
                  <PaymentItem
                    label="Parcelamento"
                    value={formatInstallmentCount(payment.installmentCount)}
                  />
                ) : null}
              </dl>
            </li>
          ))}
        </ul>
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

      <dd className="mt-2 break-all text-base font-bold text-[var(--brand-foreground)]">
        {value}
      </dd>
    </div>
  );
}

function formatPaymentMethod(method: Payment["method"]): string {
  const labels = {
    cash: "Dinheiro",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    pix: "Pix",
  } as const;

  return labels[method];
}

function formatInstallmentCount(
  installmentCount: Extract<
    Payment,
    { method: "credit_card" }
  >["installmentCount"],
): string {
  return installmentCount === 1 ? "À vista" : `${installmentCount}x`;
}
