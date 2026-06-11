import type { Metadata } from "next";
import Link from "next/link";

import { listEventsUseCase } from "@/modules/events/application/list-events-use-case";
import type { Event } from "@/modules/events/domain/event";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import {
  EventList,
  type EventListItem,
} from "@/modules/events/presentation/event-list";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Eventos | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function EventsPage() {
  const supabaseClient = await createSupabaseServerClient();
  const eventClient = supabaseClient as unknown as SupabaseEventClient;
  const eventRepository = new SupabaseEventRepository(eventClient);
  const result = await listEventsUseCase({ eventRepository });

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            className="mb-3 inline-flex text-sm font-semibold text-[#1e3275] transition hover:text-[#142456]"
            href="/"
          >
            Voltar ao painel
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
                Operacao
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Eventos</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Consulte os eventos presenciais usados para organizar vendas e
                caixa.
              </p>
            </div>
            <Link
              className="rounded-md bg-[#f5c313] px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:bg-[#e7b80f]"
              href="/events/new"
            >
              Novo evento
            </Link>
          </div>
        </header>

        {!result.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {result.formError}
          </section>
        ) : result.events.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum evento cadastrado ainda.
          </section>
        ) : (
          <EventList events={result.events.map(toEventListItem)} />
        )}
      </section>
    </main>
  );
}

function toEventListItem(event: Event): EventListItem {
  return {
    id: event.id,
    isActive: event.isActive,
    location: event.location ?? null,
    name: event.name,
    periodLabel: event.endsAt
      ? `${dateFormatter.format(event.startsAt)} - ${dateFormatter.format(
          event.endsAt,
        )}`
      : dateFormatter.format(event.startsAt),
  };
}
