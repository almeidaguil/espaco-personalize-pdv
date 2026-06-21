"use client";

import { useActionState, useMemo, useState } from "react";

import { InlineFeedback } from "@/shared/components/inline-feedback";
import { PaginationControls } from "@/shared/components/pagination-controls";
import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";

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
const pageSize = 6;

export function EventList({ action, events }: EventListProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [currentPage, setCurrentPage] = useState(1);
  const sortedEvents = useMemo(
    () => sortEventsByActiveStatus(events),
    [events],
  );
  const visibleEvents = sortedEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="grid gap-3">
      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}
      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}
      <ul className="grid gap-3">
        {visibleEvents.map((event) => (
          <Panel as="li" key={event.id} padding="sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {event.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {event.location ?? "Sem local"}
                </p>
              </div>
              <StatusBadge tone={event.isActive ? "success" : "neutral"}>
                {event.isActive ? "Ativo" : "Inativo"}
              </StatusBadge>
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
          </Panel>
        ))}
      </ul>
      <PaginationControls
        currentPage={currentPage}
        itemLabel="eventos"
        onPageChange={setCurrentPage}
        pageSize={pageSize}
        totalItems={sortedEvents.length}
      />
    </div>
  );
}

function sortEventsByActiveStatus(events: EventListItem[]): EventListItem[] {
  return [...events].sort((eventA, eventB) => {
    if (eventA.isActive === eventB.isActive) {
      return 0;
    }

    return eventA.isActive ? -1 : 1;
  });
}
