"use client";

import { useActionState } from "react";

import type { ProductActionState } from "./product-action-state";

const initialState: ProductActionState = {};

type ProductFormProps = {
  action: (
    previousState: ProductActionState,
    formData: FormData,
  ) => Promise<ProductActionState>;
};

export function ProductForm({ action }: ProductFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="name">
          Nome do produto
        </label>
        <input
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="name"
          name="name"
          placeholder="Caneca personalizada"
          type="text"
        />
        {state.fieldErrors?.name ? (
          <p className="text-sm text-red-700">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="priceInReais"
        >
          Preço
        </label>
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="priceInReais"
          inputMode="decimal"
          name="priceInReais"
          placeholder="35,00"
          type="text"
        />
        {state.fieldErrors?.priceInReais ? (
          <p className="text-sm text-red-700">
            {state.fieldErrors.priceInReais}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="sku">
          SKU
        </label>
        <input
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="sku"
          name="sku"
          placeholder="CANECA-001"
          type="text"
        />
        {state.fieldErrors?.sku ? (
          <p className="text-sm text-red-700">{state.fieldErrors.sku}</p>
        ) : null}
      </div>

      <input name="isActive" type="hidden" value="false" />
      <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
        <input
          className="h-4 w-4 rounded border-slate-300 text-[#1e3275] focus:ring-[#1e3275]"
          defaultChecked
          name="isActive"
          type="checkbox"
          value="true"
        />
        Produto ativo
      </label>

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
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Salvando..." : "Salvar produto"}
      </button>
    </form>
  );
}
