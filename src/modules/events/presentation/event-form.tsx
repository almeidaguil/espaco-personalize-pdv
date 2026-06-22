"use client";

import { useActionState } from "react";

import { FieldError } from "@/shared/components/field-error";
import { InlineFeedback } from "@/shared/components/inline-feedback";

import type { EventActionState } from "./event-action-state";

const initialState: EventActionState = {};

type EventFormProps = {
  action: (
    previousState: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
};

export function EventForm({ action }: EventFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="name">
          Nome do evento
        </label>
        <input
          aria-describedby={errors?.name ? "name-error" : undefined}
          aria-invalid={errors?.name ? true : undefined}
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="name"
          name="name"
          placeholder="Evento Julho"
          type="text"
        />
        {errors?.name ? (
          <FieldError id="name-error">{errors.name}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-slate-700"
          htmlFor="location"
        >
          Local
        </label>
        <input
          aria-describedby={errors?.location ? "location-error" : undefined}
          aria-invalid={errors?.location ? true : undefined}
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="location"
          name="location"
          placeholder="Centro de Eventos"
          type="text"
        />
        {errors?.location ? (
          <FieldError id="location-error">{errors.location}</FieldError>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="startsAt"
          >
            Inicio
          </label>
          <input
            aria-describedby={errors?.startsAt ? "startsAt-error" : undefined}
            aria-invalid={errors?.startsAt ? true : undefined}
            className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="startsAt"
            name="startsAt"
            type="datetime-local"
          />
          {errors?.startsAt ? (
            <FieldError id="startsAt-error">{errors.startsAt}</FieldError>
          ) : null}
        </div>

        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="endsAt"
          >
            Termino
          </label>
          <input
            aria-describedby={errors?.endsAt ? "endsAt-error" : undefined}
            aria-invalid={errors?.endsAt ? true : undefined}
            className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="endsAt"
            name="endsAt"
            type="datetime-local"
          />
          {errors?.endsAt ? (
            <FieldError id="endsAt-error">{errors.endsAt}</FieldError>
          ) : null}
        </div>
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
        Evento ativo
      </label>

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
        {isPending ? "Salvando..." : "Salvar evento"}
      </button>
    </form>
  );
}
