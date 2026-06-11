"use client";

import { useActionState } from "react";

import type { CashSessionActionState } from "./cash-session-action-state";

const initialState: CashSessionActionState = {};

export type OpenCashSessionEventOption = {
  id: string;
  label: string;
};

type OpenCashSessionFormProps = {
  action: (
    previousState: CashSessionActionState,
    formData: FormData,
  ) => Promise<CashSessionActionState>;
  events: OpenCashSessionEventOption[];
};

export function OpenCashSessionForm({
  action,
  events,
}: OpenCashSessionFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="eventId">
          Evento
        </label>
        <select
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          defaultValue=""
          id="eventId"
          name="eventId"
        >
          <option disabled value="">
            Selecione um evento
          </option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.eventId ? (
          <p className="text-sm text-red-700">{state.fieldErrors.eventId}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="openingAmountInReais"
        >
          Valor inicial
        </label>
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="openingAmountInReais"
          inputMode="decimal"
          name="openingAmountInReais"
          placeholder="150,00"
          type="text"
        />
        {state.fieldErrors?.openingAmountInReais ? (
          <p className="text-sm text-red-700">
            {state.fieldErrors.openingAmountInReais}
          </p>
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
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Abrindo..." : "Abrir caixa"}
      </button>
    </form>
  );
}
