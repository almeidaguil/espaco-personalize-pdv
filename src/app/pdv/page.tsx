import type { Metadata } from "next";
import Link from "next/link";

import { listActiveEventsUseCase } from "@/modules/events/application/list-active-events-use-case";
import type { Event } from "@/modules/events/domain/event";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import {
  PdvEventSelector,
  type PdvEventSelectorItem,
} from "@/modules/events/presentation/pdv-event-selector";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "PDV | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function PdvPage() {
  const supabaseClient = await createSupabaseServerClient();
  const eventClient = supabaseClient as unknown as SupabaseEventClient;
  const eventRepository = new SupabaseEventRepository(eventClient);
  const result = await listActiveEventsUseCase({ eventRepository });

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
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Vendas
          </p>
          <h1 className="mt-1 text-2xl font-semibold">PDV</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Comece selecionando o evento ativo da operacao. O carrinho e o
            pagamento entram nas proximas entregas.
          </p>
        </header>

        {!result.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {result.formError}
          </section>
        ) : result.events.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum evento ativo disponivel para venda.
          </section>
        ) : (
          <PdvEventSelector events={result.events.map(toPdvEventItem)} />
        )}
      </section>
    </main>
  );
}

function toPdvEventItem(event: Event): PdvEventSelectorItem {
  return {
    id: event.id,
    location: event.location ?? null,
    name: event.name,
    startsAtLabel: dateFormatter.format(event.startsAt),
  };
}
