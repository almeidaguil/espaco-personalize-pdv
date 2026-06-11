import type { Metadata } from "next";
import Link from "next/link";

import { listActiveEventsUseCase } from "@/modules/events/application/list-active-events-use-case";
import type { Event } from "@/modules/events/domain/event";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import { openCashSessionAction } from "@/modules/cash/presentation/open-cash-session-action";
import {
  OpenCashSessionForm,
  type OpenCashSessionEventOption,
} from "@/modules/cash/presentation/open-cash-session-form";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Abrir caixa | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function OpenCashPage() {
  const supabaseClient = await createSupabaseServerClient();
  const eventClient = supabaseClient as unknown as SupabaseEventClient;
  const eventRepository = new SupabaseEventRepository(eventClient);
  const result = await listActiveEventsUseCase({ eventRepository });

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-md gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-3 text-sm font-semibold">
            <Link
              className="text-[#1e3275] transition hover:text-[#142456]"
              href="/"
            >
              Painel
            </Link>
            <Link
              className="text-[#1e3275] transition hover:text-[#142456]"
              href="/pdv"
            >
              PDV
            </Link>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Caixa
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Abrir caixa</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Abra um caixa por evento antes de iniciar as vendas presenciais.
          </p>
        </header>

        {!result.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {result.formError}
          </section>
        ) : result.events.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum evento ativo disponivel para abertura de caixa.
          </section>
        ) : (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <OpenCashSessionForm
              action={openCashSessionAction}
              events={result.events.map(toEventOption)}
            />
          </section>
        )}
      </section>
    </main>
  );
}

function toEventOption(event: Event): OpenCashSessionEventOption {
  return {
    id: event.id,
    label: `${event.name} · ${dateFormatter.format(event.startsAt)}`,
  };
}
