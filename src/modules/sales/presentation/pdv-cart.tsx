"use client";

import { useMemo, useState } from "react";

export type PdvCartProduct = {
  id: string;
  name: string;
  priceInReais: number;
  sku?: string;
};

type CartItem = PdvCartProduct & {
  quantity: number;
};

type PdvCartProps = {
  products: PdvCartProduct[];
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function PdvCart({ products }: PdvCartProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const totalInReais = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.priceInReais * item.quantity,
        0,
      ),
    [items],
  );

  return (
    <section className="grid gap-3 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
          Carrinho
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Monte a venda
        </h2>
      </div>

      {products.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          Nenhum produto ativo disponivel para venda.
        </p>
      ) : (
        <div className="grid gap-2">
          {products.map((product) => (
            <article
              className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
              key={product.id}
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  {product.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {product.sku ?? "Sem SKU"} -{" "}
                  {moneyFormatter.format(product.priceInReais)}
                </p>
              </div>
              <button
                className="h-10 rounded-md bg-[#1e3275] px-3 text-sm font-semibold text-white transition hover:bg-[#17275c]"
                onClick={() => addProduct(product)}
                type="button"
              >
                Adicionar
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-md border border-slate-200">
        <div className="border-b border-slate-200 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-950">
            Itens da venda
          </h3>
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
                    className="h-9 w-9 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
                    onClick={() => decrementProduct(item.id)}
                    type="button"
                  >
                    -
                  </button>
                  <span className="min-w-8 text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    aria-label={`Adicionar uma unidade de ${item.name}`}
                    className="h-9 w-9 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
                    onClick={() => addProduct(item)}
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
    </section>
  );

  function addProduct(product: PdvCartProduct) {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === product.id);

      if (!existingItem) {
        return [...currentItems, { ...product, quantity: 1 }];
      }

      return currentItems.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  }

  function decrementProduct(productId: string) {
    setItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.id !== productId) {
          return [item];
        }

        if (item.quantity === 1) {
          return [];
        }

        return [{ ...item, quantity: item.quantity - 1 }];
      }),
    );
  }
}
