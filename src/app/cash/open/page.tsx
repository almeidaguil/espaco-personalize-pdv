import type { Metadata } from "next";

import { openCashSessionAction } from "@/modules/cash/presentation/open-cash-session-action";
import {
  OpenCashSessionForm,
  type OpenCashSessionEventOption,
} from "@/modules/cash/presentation/open-cash-session-form";
import { listActiveEventsUseCase } from "@/modules/events/application/list-active-events-use-case";
import type { Event } from "@/modules/events/domain/event";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
import { brand } from "@/shared/config/brand";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: `Abrir caixa | ${brand.name}`,
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function OpenCashPage() {
  const supabaseClient = await createSupabaseServerClient();

  const eventRepository = new SupabaseEventRepository(
    supabaseClient as unknown as SupabaseEventClient,
  );

  const result = await listActiveEventsUseCase({
    eventRepository,
  });

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Abrir caixa" />

      <section className="mx-auto grid w-full max-w-3xl gap-5">
        <PageHeader
          backLinks={[
            {
              href: "/pdv",
              label: "Voltar para o PDV",
            },
          ]}
          description="Selecione uma operação ativa e informe o valor inicial para começar as vendas."
          eyebrow="Caixa"
          title="Abrir caixa"
        />

        {!result.success ? (
          <LoadErrorState
            actions={[
              {
                href: "/cash/open",
                label: "Tentar novamente",
              },
            ]}
            eyebrow="Erro"
            message={
              result.formError ??
              "Verifique sua conexão e tente carregar os eventos ativos novamente."
            }
            title="Não foi possível carregar os eventos ativos"
          />
        ) : result.events.length === 0 ? (
          <EmptyState
            actions={[
              {
                href: "/events/new",
                label: "Criar evento",
              },
              {
                href: "/events",
                label: "Ver eventos",
                variant: "secondary",
              },
            ]}
            eyebrow="Sem evento ativo"
            message="O caixa precisa estar vinculado a um evento ativo."
            title="Nenhum evento ativo disponível para abertura de caixa."
          />
        ) : (
          <Panel>
            <OpenCashSessionForm
              action={openCashSessionAction}
              events={result.events.map(toEventOption)}
            />
          </Panel>
        )}
      </section>
    </PageShell>
  );
}

function toEventOption(event: Event): OpenCashSessionEventOption {
  return {
    id: event.id,
    label: `${event.name} · ${dateFormatter.format(event.startsAt)}`,
  };
}
