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
    <div className="grid gap-4">
      {state.formError ? (
        <InlineFeedback tone="error">{state.formError}</InlineFeedback>
      ) : null}

      {state.successMessage ? (
        <InlineFeedback tone="success">{state.successMessage}</InlineFeedback>
      ) : null}

      <ul className="grid gap-3">
        {visibleEvents.map((event) => (
          <Panel
            as="li"
            className="transition duration-200 hover:border-[var(--brand-accent)]/50"
            key={event.id}
            padding="sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--brand-foreground)]">
                    {event.name}
                  </h2>

                  <StatusBadge tone={event.isActive ? "success" : "neutral"}>
                    {event.isActive ? "Ativo" : "Inativo"}
                  </StatusBadge>
                </div>

                <p className="mt-2 text-sm text-[var(--brand-muted)]">
                  {event.location ?? "Sem local"}
                </p>

                <p className="mt-3 text-sm font-semibold text-[#9a7021]">
                  {event.periodLabel}
                </p>
              </div>

              {event.isActive ? (
                <form action={formAction} className="shrink-0" noValidate>
                  <input name="eventId" type="hidden" value={event.id} />

                  <button
                    className="min-h-10 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isPending}
                    type="submit"
                  >
                    {isPending ? "Finalizando..." : "Finalizar evento"}
                  </button>
                </form>
              ) : null}
            </div>
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
