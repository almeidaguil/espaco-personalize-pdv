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
  const [receivedAmountInput, setReceivedAmountInput] = useState("");
  const receivedAmountInReais = parseBrlAmount(receivedAmountInput);
  const totalInReais = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.priceInReais * item.quantity,
        0,
      ),
    [items],
  );
  const paymentDifferenceInReais = receivedAmountInReais - totalInReais;
  const hasCartItems = items.length > 0;
  const hasValidReceivedAmount = Number.isFinite(receivedAmountInReais);

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

      <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="receivedAmount"
          >
            Valor recebido
          </label>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="receivedAmount"
            inputMode="decimal"
            name="receivedAmount"
            onChange={(event) => setReceivedAmountInput(event.target.value)}
            placeholder="50,00"
            type="text"
            value={receivedAmountInput}
          />
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
          {!hasCartItems ? (
            <p className="text-sm text-slate-600">
              Adicione itens para calcular o pagamento.
            </p>
          ) : !hasValidReceivedAmount ? (
            <p className="text-sm text-slate-600">
              Informe o valor recebido para calcular o troco.
            </p>
          ) : paymentDifferenceInReais < 0 ? (
            <p className="text-sm font-semibold text-red-700">
              Falta {moneyFormatter.format(Math.abs(paymentDifferenceInReais))}
            </p>
          ) : (
            <p className="text-sm font-semibold text-emerald-700">
              Troco {moneyFormatter.format(paymentDifferenceInReais)}
            </p>
          )}
        </div>

        <button
          className="h-11 rounded-md bg-slate-300 px-4 text-sm font-semibold text-slate-600"
          disabled
          type="button"
        >
          Finalizar venda
        </button>
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

function parseBrlAmount(value: string): number {
  const normalizedValue = value
    .trim()
    .replace(/^R\$\s?/, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalizedValue) {
    return Number.NaN;
  }

  return Number(normalizedValue);
}
