import type { Metadata } from "next";
import Link from "next/link";

import { createEventAction } from "@/modules/events/presentation/create-event-action";
import { EventForm } from "@/modules/events/presentation/event-form";

export const metadata: Metadata = {
  title: "Novo evento | Espaco Personalize PDV",
};

export default function NewEventPage() {
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
              href="/events"
            >
              Eventos
            </Link>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Eventos
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Novo evento</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cadastre eventos presenciais para organizar vendas, caixa e
            relatorios por operacao.
          </p>
        </header>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <EventForm action={createEventAction} />
        </section>
      </section>
    </main>
  );
}
