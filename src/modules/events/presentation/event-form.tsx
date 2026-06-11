"use client";

import { useActionState } from "react";

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

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <label className="text-sm font-medium text-slate-700" htmlFor="name">
          Nome do evento
        </label>
        <input
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="name"
          name="name"
          placeholder="Evento Julho"
          type="text"
        />
        {state.fieldErrors?.name ? (
          <p className="text-sm text-red-700">{state.fieldErrors.name}</p>
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
          autoComplete="off"
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="location"
          name="location"
          placeholder="Centro de Eventos"
          type="text"
        />
        {state.fieldErrors?.location ? (
          <p className="text-sm text-red-700">{state.fieldErrors.location}</p>
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
            className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="startsAt"
            name="startsAt"
            type="datetime-local"
          />
          {state.fieldErrors?.startsAt ? (
            <p className="text-sm text-red-700">{state.fieldErrors.startsAt}</p>
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
            className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="endsAt"
            name="endsAt"
            type="datetime-local"
          />
          {state.fieldErrors?.endsAt ? (
            <p className="text-sm text-red-700">{state.fieldErrors.endsAt}</p>
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
        {isPending ? "Salvando..." : "Salvar evento"}
      </button>
    </form>
  );
}
