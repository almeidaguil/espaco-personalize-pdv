"use client";

import { useActionState } from "react";
import type { EventActionState } from "./event-action-state";

export type EventListItem = {
  id: string;
  isActive: boolean;
  location: string | null;
  name: string;
  periodLabel: string;
};

type EventListProps = {
  action: (
    previousState: EventActionState,
    formData: FormData,
  ) => Promise<EventActionState>;
  events: EventListItem[];
};

const initialState: EventActionState = {};

export function EventList({ action, events }: EventListProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="grid gap-3">
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
      <ul className="grid gap-3">
        {events.map((event) => (
          <li
            className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
            key={event.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {event.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {event.location ?? "Sem local"}
                </p>
              </div>
              <span
                className={
                  event.isActive
                    ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                    : "rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
                }
              >
                {event.isActive ? "Ativo" : "Inativo"}
              </span>
            </div>

            <strong className="mt-4 block text-sm text-[#1e3275]">
              {event.periodLabel}
            </strong>

            {event.isActive ? (
              <form action={formAction} className="mt-4" noValidate>
                <input name="eventId" type="hidden" value={event.id} />
                <button
                  className="h-10 rounded-md border border-slate-200 px-3 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275] disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "Finalizando..." : "Finalizar evento"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
