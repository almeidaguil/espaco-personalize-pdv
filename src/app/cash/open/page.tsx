import type { Metadata } from "next";

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
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
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
    <PageShell maxWidth="sm">
      <PageHeader
        backLinks={[
          { href: "/", label: "Painel" },
          { href: "/pdv", label: "PDV" },
        ]}
        description="Abra um caixa por evento antes de iniciar as vendas presenciais."
        eyebrow="Caixa"
        title="Abrir caixa"
      />

      {!result.success ? (
        <LoadErrorState
          actions={[{ href: "/cash/open", label: "Tentar novamente" }]}
          eyebrow="Erro"
          message={
            result.formError ??
            "Verifique sua conexao e tente carregar os eventos ativos novamente."
          }
          title="Nao foi possivel carregar eventos ativos"
        />
      ) : result.events.length === 0 ? (
        <EmptyState
          actions={[
            { href: "/events/new", label: "Criar evento" },
            { href: "/events", label: "Ver eventos", variant: "secondary" },
          ]}
          eyebrow="Sem evento ativo"
          message="O caixa sempre precisa estar vinculado a um evento ativo."
          title="Nenhum evento ativo disponivel para abertura de caixa."
        />
      ) : (
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <OpenCashSessionForm
            action={openCashSessionAction}
            events={result.events.map(toEventOption)}
          />
        </section>
      )}
    </PageShell>
  );
}

function toEventOption(event: Event): OpenCashSessionEventOption {
  return {
    id: event.id,
    label: `${event.name} · ${dateFormatter.format(event.startsAt)}`,
  };
}
