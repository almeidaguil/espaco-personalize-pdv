"use client";

import type { PdvCartItem, PdvCartProduct } from "./pdv-cart";

type CartItemsProps = {
  items: PdvCartItem[];
  onAddProduct: (product: PdvCartProduct) => void;
  onDecrementProduct: (productId: string) => void;
  totalInReais: number;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function CartItems({
  items,
  onAddProduct,
  onDecrementProduct,
  totalInReais,
}: CartItemsProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h3 className="text-sm font-bold text-[var(--brand-foreground)]">
          Itens da venda
        </h3>

        <span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--brand-muted)]">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-[var(--brand-muted)]">
          Nenhum item adicionado.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => (
            <li
              className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-[var(--brand-foreground)]">
                  {item.name}
                </p>

                <p className="mt-1 text-sm text-[var(--brand-muted)]">
                  {item.quantity} × {moneyFormatter.format(item.priceInReais)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label={`Remover uma unidade de ${item.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-lg font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)]"
                  onClick={() => onDecrementProduct(item.id)}
                  type="button"
                >
                  −
                </button>

                <span className="min-w-8 text-center text-sm font-bold text-[var(--brand-foreground)]">
                  {item.quantity}
                </span>

                <button
                  aria-label={`Adicionar uma unidade de ${item.name}`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white text-lg font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)]"
                  onClick={() => onAddProduct(item)}
                  type="button"
                >
                  +
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4">
        <span className="text-sm font-semibold text-[var(--brand-muted)]">
          Total
        </span>

        <strong className="text-xl font-bold text-[var(--brand-foreground)]">
          {moneyFormatter.format(totalInReais)}
        </strong>
      </div>
    </div>
  );
}
