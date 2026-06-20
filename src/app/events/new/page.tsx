import type { Metadata } from "next";

import { createEventAction } from "@/modules/events/presentation/create-event-action";
import { EventForm } from "@/modules/events/presentation/event-form";
import { PageHeader, PageShell } from "@/shared/components/page-shell";

export const metadata: Metadata = {
  title: "Novo evento | Espaco Personalize PDV",
};

export default function NewEventPage() {
  return (
    <PageShell maxWidth="sm">
      <PageHeader
        backLinks={[
          { href: "/", label: "Painel" },
          { href: "/events", label: "Eventos" },
        ]}
        description="Cadastre eventos presenciais para organizar vendas, caixa e relatorios por operacao."
        eyebrow="Eventos"
        title="Novo evento"
      />

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <EventForm action={createEventAction} />
      </section>
    </PageShell>
  );
}
