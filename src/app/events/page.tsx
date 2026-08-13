import type { Metadata } from "next";

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
import { closeEventAction } from "@/modules/events/presentation/close-event-action";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
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
    <PageShell>
      <PageHeader
        actions={[{ href: "/events/new", label: "Novo evento" }]}
        description="Consulte os eventos presenciais usados para organizar vendas e caixa."
        eyebrow="Operacao"
        title="Eventos"
      />

      {!result.success ? (
        <LoadErrorState
          actions={[{ href: "/events", label: "Tentar novamente" }]}
          eyebrow="Erro"
          message={
            result.formError ??
            "Verifique sua conexao e tente carregar os eventos novamente."
          }
          title="Nao foi possivel carregar os eventos"
        />
      ) : result.events.length === 0 ? (
        <EmptyState
          actions={[{ href: "/events/new", label: "Criar evento" }]}
          eyebrow="Sem eventos"
          message="Crie um evento ativo para abrir caixa e registrar vendas."
          title="Nenhum evento cadastrado ainda."
        />
      ) : (
        <EventList
          action={closeEventAction}
          events={result.events.map(toEventListItem)}
        />
      )}
    </PageShell>
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
