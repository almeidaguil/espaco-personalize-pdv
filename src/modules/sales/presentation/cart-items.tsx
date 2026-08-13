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
    <div className="rounded-md border border-slate-200">
      <div className="border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-950">Itens da venda</h3>
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-600">
          Nenhum item adicionado.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {items.map((item) => (
            <li
              className="grid gap-3 px-3 py-3 sm:grid-cols-[1fr_auto]"
              key={item.id}
            >
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {item.name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.quantity} x {moneyFormatter.format(item.priceInReais)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  aria-label={`Remover uma unidade de ${item.name}`}
                  className="h-11 w-11 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
                  onClick={() => onDecrementProduct(item.id)}
                  type="button"
                >
                  -
                </button>
                <span className="min-w-8 text-center text-sm font-semibold">
                  {item.quantity}
                </span>
                <button
                  aria-label={`Adicionar uma unidade de ${item.name}`}
                  className="h-11 w-11 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
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

      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3">
        <span className="text-sm font-semibold text-slate-700">Total</span>
        <strong className="text-lg text-slate-950">
          {moneyFormatter.format(totalInReais)}
        </strong>
      </div>
    </div>
  );
}
