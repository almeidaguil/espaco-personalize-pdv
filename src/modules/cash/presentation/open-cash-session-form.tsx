"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";

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
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="eventId">
          Evento
        </label>
        <select
          aria-describedby={errors?.eventId ? "eventId-error" : undefined}
          aria-invalid={errors?.eventId ? true : undefined}
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
        {errors?.eventId ? (
          <FieldError id="eventId-error">{errors.eventId}</FieldError>
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
          aria-describedby={
            errors?.openingAmountInReais
              ? "openingAmountInReais-error"
              : undefined
          }
          aria-invalid={errors?.openingAmountInReais ? true : undefined}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="openingAmountInReais"
          inputMode="decimal"
          name="openingAmountInReais"
          placeholder="150,00"
          type="text"
        />
        {errors?.openingAmountInReais ? (
          <FieldError id="openingAmountInReais-error">
            {errors.openingAmountInReais}
          </FieldError>
        ) : null}
      </div>

      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
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
