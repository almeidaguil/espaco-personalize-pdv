"use client";

import { useActionState, useCallback, useMemo, useState } from "react";

import { InlineFeedback } from "@/shared/components/inline-feedback";
import { Panel } from "@/shared/components/panel";

import type { PaymentMethod } from "../domain/sale";
import { CartItems } from "./cart-items";
import { ProductPicker } from "./product-picker";
import type { SaleActionState } from "./sale-action-state";

export type PdvCartProduct = {
  id: string;
  name: string;
  priceInReais: number;
  quantityOnHand: number;
  sku?: string;
};

export type PdvCartItem = PdvCartProduct & {
  quantity: number;
};

export type PdvCartCashSession = {
  eventId: string;
  eventName: string;
  id: string;
};

type PdvCartProps = {
  action: (
    previousState: SaleActionState,
    formData: FormData,
  ) => Promise<SaleActionState>;
  cashSessions: PdvCartCashSession[];
  products: PdvCartProduct[];
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  credit_card: "Cartao de credito",
  debit_card: "Cartao de debito",
  pix: "Pix",
};

export function PdvCart({ action, cashSessions, products }: PdvCartProps) {
  const [items, setItems] = useState<PdvCartItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [receivedAmountInput, setReceivedAmountInput] = useState("");
  const [cashSessionId, setCashSessionId] = useState(cashSessions[0]?.id ?? "");
  const submitSale = useCallback(
    async (previousState: SaleActionState, formData: FormData) => {
      const nextState = await action(previousState, formData);

      if (nextState.successMessage) {
        setItems([]);
        setProductSearchTerm("");
        setProductPage(1);
        setPaymentMethod("cash");
        setReceivedAmountInput("");
      }

      return nextState;
    },
    [action],
  );
  const [state, formAction, isPending] = useActionState(submitSale, {});

  const selectedCashSession = cashSessions.find(
    (session) => session.id === cashSessionId,
  );
  const totalInReais = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.priceInReais * item.quantity,
        0,
      ),
    [items],
  );
  const cartQuantitiesByProductId = useMemo(
    () => new Map(items.map((item) => [item.id, item.quantity])),
    [items],
  );
  const hasCartItems = items.length > 0;
  const hasAvailableStockForItems = items.every(
    (item) => item.quantityOnHand > 0 && item.quantity <= item.quantityOnHand,
  );
  const effectiveReceivedAmountInput =
    paymentMethod === "cash"
      ? receivedAmountInput
      : totalInReais > 0
        ? formatBrlAmount(totalInReais)
        : "";
  const receivedAmountInReais = parseBrlAmount(effectiveReceivedAmountInput);
  const paymentDifferenceInReais = receivedAmountInReais - totalInReais;
  const hasValidReceivedAmount = Number.isFinite(receivedAmountInReais);
  const canSubmit =
    Boolean(selectedCashSession) &&
    hasCartItems &&
    hasValidReceivedAmount &&
    hasAvailableStockForItems &&
    (paymentMethod === "cash"
      ? paymentDifferenceInReais >= 0
      : paymentDifferenceInReais === 0) &&
    !isPending;

  return (
    <Panel action={formAction} as="form" className="grid gap-3">
      <input
        name="eventId"
        type="hidden"
        value={selectedCashSession?.eventId ?? ""}
      />
      <input
        name="itemsJson"
        type="hidden"
        value={JSON.stringify(toSaleItems(items))}
      />
      <input name="paymentMethod" type="hidden" value={paymentMethod} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
          Carrinho
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Monte a venda
        </h2>
      </div>

      <ProductPicker
        cartQuantitiesByProductId={cartQuantitiesByProductId}
        onAddProduct={addProduct}
        onPageChange={setProductPage}
        onSearchTermChange={updateProductSearchTerm}
        page={productPage}
        products={products}
        searchTerm={productSearchTerm}
      />

      <CartItems
        items={items}
        onAddProduct={addProduct}
        onDecrementProduct={decrementProduct}
        totalInReais={totalInReais}
      />

      <div className="sticky bottom-0 z-10 -mx-5 grid gap-3 border-t border-slate-200 bg-slate-50 p-5 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:static sm:mx-0 sm:rounded-md sm:border sm:p-3 sm:shadow-none">
        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="cashSessionId"
          >
            Caixa da venda
          </label>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="cashSessionId"
            name="cashSessionId"
            onChange={(event) => setCashSessionId(event.target.value)}
            value={cashSessionId}
          >
            {cashSessions.length === 0 ? (
              <option value="">Nenhum caixa aberto</option>
            ) : (
              cashSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.eventName}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium text-slate-700" id="paymentMethod">
            Forma de pagamento
          </p>
          <div
            aria-labelledby="paymentMethod"
            className="grid grid-cols-2 gap-2"
            role="group"
          >
            {(
              Object.entries(paymentMethodLabels) as Array<
                [PaymentMethod, string]
              >
            ).map(([value, label]) => (
              <button
                aria-pressed={paymentMethod === value}
                className={
                  paymentMethod === value
                    ? "min-h-11 rounded-md border border-[#1e3275] bg-[#1e3275] px-3 text-sm font-semibold text-white transition"
                    : "min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
                }
                key={value}
                onClick={() => setPaymentMethod(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="receivedAmount"
          >
            {paymentMethod === "cash" ? "Valor recebido" : "Valor do pagamento"}
          </label>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="receivedAmount"
            inputMode="decimal"
            name="amountReceivedInReais"
            onChange={(event) => setReceivedAmountInput(event.target.value)}
            placeholder={paymentMethod === "cash" ? "50,00" : "Total da venda"}
            readOnly={paymentMethod !== "cash"}
            type="text"
            value={effectiveReceivedAmountInput}
          />
          {paymentMethod !== "cash" ? (
            <p className="text-xs leading-5 text-slate-500">
              Para {paymentMethodLabels[paymentMethod].toLowerCase()}, o sistema
              registra o valor exato da venda.
            </p>
          ) : null}
          {paymentMethod === "cash" && hasCartItems ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
                onClick={() =>
                  setReceivedAmountInput(formatBrlAmount(totalInReais))
                }
                type="button"
              >
                Valor exato
              </button>
              {[50, 100].map((amountInReais) => (
                <button
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
                  key={amountInReais}
                  onClick={() =>
                    setReceivedAmountInput(formatBrlAmount(amountInReais))
                  }
                  type="button"
                >
                  {moneyFormatter.format(amountInReais)}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
          {!hasCartItems ? (
            <p className="text-sm text-slate-600">
              Adicione itens para calcular o pagamento.
            </p>
          ) : !hasAvailableStockForItems ? (
            <p className="text-sm font-semibold text-red-700">
              Ajuste o carrinho para respeitar o estoque disponivel.
            </p>
          ) : paymentMethod !== "cash" ? (
            <p className="text-sm font-semibold text-slate-700">
              {paymentMethodLabels[paymentMethod]} no valor de{" "}
              {moneyFormatter.format(totalInReais)}
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

        {state.successMessage ? (
          <InlineFeedback className="py-3 font-semibold" tone="success">
            {state.successMessage}
          </InlineFeedback>
        ) : null}
        {state.formError ? (
          <InlineFeedback className="py-3 font-semibold" tone="error">
            {state.formError}
          </InlineFeedback>
        ) : null}

        <button
          className="min-h-12 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:bg-slate-300 disabled:text-slate-600"
          disabled={!canSubmit}
          type="submit"
        >
          {isPending ? "Finalizando..." : "Finalizar venda"}
        </button>
      </div>
    </Panel>
  );

  function addProduct(product: PdvCartProduct) {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === product.id);

      if (!existingItem) {
        if (product.quantityOnHand <= 0) {
          return currentItems;
        }

        return [...currentItems, { ...product, quantity: 1 }];
      }

      if (existingItem.quantity >= existingItem.quantityOnHand) {
        return currentItems;
      }

      return currentItems.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  }

  function updateProductSearchTerm(searchTerm: string) {
    setProductSearchTerm(searchTerm);
    setProductPage(1);
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

function toSaleItems(items: PdvCartItem[]) {
  return items.map((item) => ({
    productId: item.id,
    quantity: item.quantity,
  }));
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

function formatBrlAmount(value: number): string {
  return value.toFixed(2).replace(".", ",");
}
