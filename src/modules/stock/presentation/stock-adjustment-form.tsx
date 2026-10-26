"use client";

import { useActionState, useState } from "react";
import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";
import type { StockAdjustmentActionState } from "./stock-adjustment-action-state";
import {
  StockProductCombobox,
  type StockAdjustmentProductOption,
} from "./stock-product-combobox";

const initialState: StockAdjustmentActionState = {};
export type { StockAdjustmentProductOption } from "./stock-product-combobox";

type StockAdjustmentFormProps = {
  action: (
    previousState: StockAdjustmentActionState,
    formData: FormData,
  ) => Promise<StockAdjustmentActionState>;
  products: (StockAdjustmentProductOption & { quantityOnHand: number })[];
  fixedProductId?: string;
};

export function StockAdjustmentForm({
  action,
  products,
  fixedProductId,
}: StockAdjustmentFormProps) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const validQuantity =
    /^\d+$/.test(quantity) &&
    Number.isSafeInteger(Number(quantity)) &&
    Number(quantity) > 0;
  const selectedProduct = products.find(
    (product) => product.id === (fixedProductId ?? selectedProductId),
  );
  const currentBalance = selectedProduct?.quantityOnHand;
  const nextBalance =
    currentBalance !== undefined && validQuantity
      ? currentBalance +
        (direction === "remove" ? -Number(quantity) : Number(quantity))
      : undefined;
  const quantityError =
    quantity && !validQuantity
      ? "Informe uma quantidade inteira maior que zero."
      : nextBalance !== undefined && nextBalance < 0
        ? `Não é possível remover ${quantity} unidades. O estoque atual é de ${currentBalance} unidades.`
        : undefined;
  const [state, formAction, isPending] = useActionState(
    async (
      previousState: StockAdjustmentActionState,
      formData: FormData,
    ): Promise<StockAdjustmentActionState> => {
      if (!validQuantity || quantityError || !selectedProduct) {
        return {
          fieldErrors: {
            quantity:
              quantityError ?? "Informe uma quantidade inteira maior que zero.",
          },
        };
      }
      formData.set("type", "manual_adjustment");
      formData.set("productId", selectedProduct.id);
      formData.set(
        "quantity",
        String(direction === "remove" ? -Number(quantity) : Number(quantity)),
      );
      const result = await action(previousState, formData);
      if (result.successMessage) setQuantity("");
      return result;
    },
    initialState,
  );
  const errors = {
    ...state.fieldErrors,
    quantity: quantityError ?? state.fieldErrors?.quantity,
  };

  return (
    <form action={formAction} className="grid min-w-0 gap-5" noValidate>
      <fieldset className="grid min-w-0 gap-5" disabled={isPending}>
        <div className="grid min-w-0 gap-2">
          {fixedProductId ? null : (
            <StockProductCombobox
              errorId={errors.productId ? "productId-error" : undefined}
              invalid={Boolean(errors.productId)}
              onSelectionChange={setSelectedProductId}
              products={products}
            />
          )}
          {errors.productId ? (
            <FieldError id="productId-error">{errors.productId}</FieldError>
          ) : null}
        </div>
        {currentBalance !== undefined ? (
          <p
            className="rounded-xl bg-[var(--surface-muted)] p-4 text-lg font-semibold"
            role="status"
            aria-label="Estoque atual"
          >
            Estoque atual: {currentBalance}{" "}
            {currentBalance === 1 ? "unidade" : "unidades"}
          </p>
        ) : null}
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold text-[var(--brand-foreground)]">
            Movimentação
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["add", "remove"] as const).map((value) => (
              <label
                key={value}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-4 text-sm font-semibold"
              >
                <input
                  type="radio"
                  name="direction"
                  value={value}
                  checked={direction === value}
                  onChange={() => setDirection(value)}
                  className="h-4 w-4 shrink-0 accent-[var(--brand-primary)]"
                />
                {value === "add"
                  ? "+ Adicionar ao estoque"
                  : "− Remover do estoque"}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2">
          <label
            className="text-sm font-semibold text-[var(--brand-foreground)]"
            htmlFor="quantity"
          >
            Quantidade
          </label>
          <input
            aria-describedby={errors.quantity ? "quantity-error" : undefined}
            aria-invalid={errors.quantity ? true : undefined}
            className="h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
            id="quantity"
            inputMode="numeric"
            name="quantity"
            placeholder="Ex.: 10"
            type="text"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          {errors.quantity ? (
            <FieldError id="quantity-error">{errors.quantity}</FieldError>
          ) : null}
        </div>
        <p
          className="rounded-xl bg-[var(--surface-muted)] p-4 text-lg font-semibold"
          role="status"
          aria-label="Novo saldo"
          aria-live="polite"
        >
          Novo saldo:{" "}
          {nextBalance !== undefined && nextBalance >= 0
            ? `${nextBalance} ${nextBalance === 1 ? "unidade" : "unidades"}`
            : "—"}
        </p>
        {state.formError ? (
          <InlineFeedback tone="error">{state.formError}</InlineFeedback>
        ) : null}
        {state.successMessage ? (
          <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
        ) : null}
        <button
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-5 py-3 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            isPending ||
            !selectedProduct ||
            !validQuantity ||
            Boolean(quantityError)
          }
          type="submit"
        >
          {isPending
            ? "Salvando..."
            : direction === "add"
              ? "Adicionar ao estoque"
              : "Remover do estoque"}
        </button>
      </fieldset>
    </form>
  );
}
