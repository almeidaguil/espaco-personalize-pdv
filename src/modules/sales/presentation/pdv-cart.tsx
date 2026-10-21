"use client";

import { useActionState, useCallback, useMemo, useState } from "react";

import { InlineFeedback } from "@/shared/components/inline-feedback";
import { Panel } from "@/shared/components/panel";
import { parseBrlCurrencyToCents } from "@/shared/utils/brl-currency";

import { CartItems } from "./cart-items";
import {
  normalizePaymentDraftsForTotal,
  type PaymentDraft,
  summarizePaymentDrafts,
} from "./pdv-payment";
import { PdvPaymentSection } from "./pdv-payment-section";
import { ProductPicker } from "./product-picker";
import type { SaleActionState } from "./sale-action-state";

export type PdvCartProduct = {
  id: string;
  name: string;
  priceInCents: number;
  quantityOnHand: number;
  sku?: string;
};

export type PdvCartItem = PdvCartProduct & {
  quantity: number;
};

type PdvCartProps = {
  action: (
    previousState: SaleActionState,
    formData: FormData,
  ) => Promise<SaleActionState>;
  products: PdvCartProduct[];
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function PdvCart({ action, products }: PdvCartProps) {
  const [items, setItems] = useState<PdvCartItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  const [productPage, setProductPage] = useState(1);

  const [discountInput, setDiscountInput] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState<PaymentDraft[]>([
    createInitialPaymentDraft(),
  ]);

  const submitSale = useCallback(
    async (previousState: SaleActionState, formData: FormData) => {
      const nextState = await action(previousState, formData);

      if (nextState.successMessage) {
        setItems([]);
        setProductSearchTerm("");
        setProductPage(1);
        setDiscountInput("");
        setPaymentDrafts([createInitialPaymentDraft()]);
      }

      return nextState;
    },
    [action],
  );

  const [state, formAction, isPending] = useActionState(submitSale, {});

  const subtotalInCents = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.priceInCents * item.quantity,
        0,
      ),
    [items],
  );

  const parsedDiscountInCents = discountInput.trim()
    ? parseBrlCurrencyToCents(discountInput)
    : 0;
  const discountError = getDiscountError(
    discountInput,
    parsedDiscountInCents,
    subtotalInCents,
  );
  const discountInCents = discountError ? 0 : parsedDiscountInCents;
  const totalInCents = subtotalInCents - discountInCents;

  const cartQuantitiesByProductId = useMemo(
    () => new Map(items.map((item) => [item.id, item.quantity])),
    [items],
  );

  const hasCartItems = items.length > 0;

  const hasAvailableStockForItems = items.every(
    (item) => item.quantityOnHand > 0 && item.quantity <= item.quantityOnHand,
  );

  const normalizedPaymentDrafts = normalizePaymentDraftsForTotal(
    paymentDrafts,
    totalInCents,
  );
  const paymentSummary = summarizePaymentDrafts(
    normalizedPaymentDrafts,
    totalInCents,
  );

  const canSubmit =
    hasCartItems &&
    !discountError &&
    hasAvailableStockForItems &&
    paymentSummary.isValid &&
    !isPending;

  return (
    <Panel action={formAction} as="form" className="grid gap-5">
      <input
        name="itemsJson"
        type="hidden"
        value={JSON.stringify(toSaleItems(items))}
      />

      <input
        name="paymentsJson"
        type="hidden"
        value={JSON.stringify(toSalePayments(normalizedPaymentDrafts))}
      />

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent-foreground)]">
          Carrinho
        </p>

        <h2 className="mt-1.5 text-xl font-bold text-[var(--brand-foreground)]">
          Monte a venda
        </h2>

        <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
          Localize os produtos, adicione ao carrinho e finalize o pagamento.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
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
          subtotalInCents={subtotalInCents}
        />
      </div>

      <section className="-mx-5 grid gap-5 border-t border-[var(--border)] bg-white/95 p-5 sm:static sm:bottom-0 sm:z-10 sm:mx-0 sm:rounded-2xl sm:border sm:bg-[var(--surface-muted)] sm:shadow-none sm:backdrop-blur-xl">
        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-[var(--brand-foreground)]"
            htmlFor="discount"
          >
            Desconto (R$)
          </label>

          <input
            aria-describedby={discountError ? "discountError" : undefined}
            aria-invalid={Boolean(discountError)}
            className="h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15 aria-invalid:border-red-500"
            id="discount"
            inputMode="decimal"
            name="discountInReais"
            onChange={(event) => setDiscountInput(event.target.value)}
            placeholder="0,00"
            type="text"
            value={discountInput}
          />

          {discountError ? (
            <p
              className="text-sm font-semibold text-red-700"
              id="discountError"
            >
              {discountError}
            </p>
          ) : state.fieldErrors?.discountInCents ? (
            <p className="text-sm font-semibold text-red-700">
              {state.fieldErrors.discountInCents}
            </p>
          ) : null}
        </div>

        <PdvPaymentSection
          drafts={normalizedPaymentDrafts}
          errorMessage={state.fieldErrors?.payments}
          onChange={setPaymentDrafts}
          totalInCents={totalInCents}
        />

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

        <div className="grid gap-4 border-t border-[var(--border)] pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <dl className="grid gap-2">
            <SaleTotalRow
              label="Subtotal"
              value={moneyFormatter.format(subtotalInCents / 100)}
            />
            <SaleTotalRow
              label="Desconto"
              value={`− ${moneyFormatter.format(discountInCents / 100)}`}
            />
            <SaleTotalRow
              emphasized
              label="Total da venda"
              value={moneyFormatter.format(totalInCents / 100)}
            />
          </dl>

          <button
            className="min-h-12 rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-6 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300 disabled:text-neutral-500"
            disabled={!canSubmit}
            type="submit"
          >
            {isPending ? "Finalizando..." : "Finalizar venda"}
          </button>
        </div>
      </section>
    </Panel>
  );

  function addProduct(product: PdvCartProduct) {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === product.id);

      if (!existingItem) {
        if (product.quantityOnHand <= 0) {
          return currentItems;
        }

        return [
          ...currentItems,
          {
            ...product,
            quantity: 1,
          },
        ];
      }

      if (existingItem.quantity >= existingItem.quantityOnHand) {
        return currentItems;
      }

      return currentItems.map((item) =>
        item.id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
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

        return [
          {
            ...item,
            quantity: item.quantity - 1,
          },
        ];
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

function createInitialPaymentDraft(): PaymentDraft {
  return { amountInput: "", method: "cash" };
}

function toSalePayments(drafts: PaymentDraft[]) {
  return drafts.map((draft) =>
    draft.method === "credit_card"
      ? {
          amountInReais: draft.amountInput,
          installmentCount: draft.installmentCount,
          method: draft.method,
        }
      : {
          amountInReais: draft.amountInput,
          method: draft.method,
        },
  );
}

function getDiscountError(
  input: string,
  discountInCents: number,
  subtotalInCents: number,
): string | undefined {
  if (input.trim() && !Number.isSafeInteger(discountInCents)) {
    return "Informe um desconto válido em reais, com no máximo 2 casas decimais.";
  }

  if (discountInCents > 0 && subtotalInCents === 0) {
    return "Adicione itens antes de aplicar desconto.";
  }

  if (subtotalInCents > 0 && discountInCents >= subtotalInCents) {
    return "O desconto deve ser menor que o subtotal.";
  }

  return undefined;
}

function SaleTotalRow({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt
        className={
          emphasized
            ? "text-sm font-bold text-[var(--brand-foreground)]"
            : "text-sm font-semibold text-[var(--brand-muted)]"
        }
      >
        {label}
      </dt>
      <dd
        className={
          emphasized
            ? "text-2xl font-bold text-[var(--brand-foreground)]"
            : "text-base font-bold text-[var(--brand-foreground)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}
