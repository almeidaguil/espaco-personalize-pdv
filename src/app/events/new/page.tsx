import type { Metadata } from "next";

import { createEventAction } from "@/modules/events/presentation/create-event-action";
import { EventForm } from "@/modules/events/presentation/event-form";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { brand } from "@/shared/config/brand";

export const metadata: Metadata = {
  title: `Novo evento | ${brand.name}`,
};

export default function NewEventPage() {
  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Novo evento" />

      <section className="mx-auto grid w-full max-w-3xl gap-5">
        <PageHeader
          backLinks={[
            {
              href: "/events",
              label: "Voltar para eventos",
            },
          ]}
          description="Cadastre uma operação para organizar caixa e vendas."
          eyebrow="Operação"
          title="Novo evento"
        />

        <Panel>
          <EventForm action={createEventAction} />
        </Panel>
      </section>
    </PageShell>
  );
}
