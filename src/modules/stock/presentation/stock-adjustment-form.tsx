"use client";

import { useActionState } from "react";

import type { StockAdjustmentActionState } from "./stock-adjustment-action-state";

const initialState: StockAdjustmentActionState = {};

export type StockAdjustmentProductOption = {
  id: string;
  label: string;
};

type StockAdjustmentFormProps = {
  action: (
    previousState: StockAdjustmentActionState,
    formData: FormData,
  ) => Promise<StockAdjustmentActionState>;
  products: StockAdjustmentProductOption[];
};

export function StockAdjustmentForm({
  action,
  products,
}: StockAdjustmentFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const hasProducts = products.length > 0;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="productId"
        >
          Produto
        </label>
        <select
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          disabled={!hasProducts}
          id="productId"
          name="productId"
        >
          <option value="">
            {hasProducts ? "Selecione um produto" : "Nenhum produto ativo"}
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.productId ? (
          <p className="text-sm text-red-700">{state.fieldErrors.productId}</p>
        ) : null}
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-700">
          Tipo de ajuste
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input
              className="mt-1 h-4 w-4 border-slate-300 text-[#1e3275] focus:ring-[#1e3275]"
              defaultChecked
              name="type"
              type="radio"
              value="initial_adjustment"
            />
            <span>
              <strong className="block text-slate-950">Ajuste inicial</strong>
              Entrada positiva para preparar o saldo.
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input
              className="mt-1 h-4 w-4 border-slate-300 text-[#1e3275] focus:ring-[#1e3275]"
              name="type"
              type="radio"
              value="manual_adjustment"
            />
            <span>
              <strong className="block text-slate-950">Ajuste manual</strong>
              Use positivo para entrada e negativo para saida.
            </span>
          </label>
        </div>
        {state.fieldErrors?.type ? (
          <p className="text-sm text-red-700">{state.fieldErrors.type}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="quantity"
        >
          Quantidade
        </label>
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="quantity"
          inputMode="numeric"
          name="quantity"
          placeholder="10"
          type="number"
        />
        {state.fieldErrors?.quantity ? (
          <p className="text-sm text-red-700">{state.fieldErrors.quantity}</p>
        ) : null}
      </div>

      {state.formError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </p>
      ) : null}

      {state.successMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.successMessage}
        </p>
      ) : null}

      <button
        className="h-11 rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending || !hasProducts}
        type="submit"
      >
        {isPending ? "Ajustando..." : "Registrar ajuste"}
      </button>
    </form>
  );
}
