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
    <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            {sale.eventName}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {moneyFormatter.format(sale.totalInReais)}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {dateFormatter.format(sale.completedAt)}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
          {sale.status === "completed" ? "Concluida" : "Cancelada"}
        </span>
      </div>

      <div className="rounded-md border border-slate-200">
        <div className="border-b border-slate-200 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-950">Itens</h3>
        </div>
        <ul className="divide-y divide-slate-200">
          {sale.items.map((item) => (
            <li className="grid gap-1 px-3 py-3" key={item.productId}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-950">
                  {item.productName}
                </p>
                <strong className="text-sm text-slate-950">
                  {moneyFormatter.format(item.totalInReais)}
                </strong>
              </div>
              <p className="text-sm text-slate-600">
                {item.quantity} x {moneyFormatter.format(item.unitPriceInReais)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-slate-600">Metodo</span>
          <strong className="text-slate-950">
            {formatPaymentMethod(sale.payment.method)}
          </strong>
        </div>
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-slate-600">Pagamento</span>
          <strong className="text-slate-950">
            {moneyFormatter.format(sale.payment.amountInReais)}
          </strong>
        </div>
        <div className="flex justify-between gap-3 text-sm">
          <span className="text-slate-600">Troco</span>
          <strong className="text-slate-950">
            {moneyFormatter.format(sale.payment.changeInReais)}
          </strong>
        </div>
      </div>
    </section>
  );
}

function formatPaymentMethod(method: SaleDetail["payment"]["method"]): string {
  const labels = {
    cash: "Dinheiro",
    credit_card: "Cartao de credito",
    debit_card: "Cartao de debito",
    pix: "Pix",
  } as const;

  return labels[method];
}
