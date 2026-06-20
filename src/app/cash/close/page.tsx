import type { Metadata } from "next";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { listCashSessionClosingSummariesUseCase } from "@/modules/cash/application/list-cash-session-closing-summaries-use-case";
import { listOpenCashSessionsUseCase } from "@/modules/cash/application/list-open-cash-sessions-use-case";
import type { CashSessionClosingSummary } from "@/modules/cash/application/cash-session-closing-summary-repository";
import type { CashSession } from "@/modules/cash/domain/cash-session";
import {
  SupabaseCashSessionClosingSummaryRepository,
  type SupabaseCashSessionClosingSummaryClient,
} from "@/modules/cash/infra/supabase-cash-session-closing-summary-repository";
import {
  SupabaseCashSessionRepository,
  type SupabaseCashSessionClient,
} from "@/modules/cash/infra/supabase-cash-session-repository";
import { closeCashSessionAction } from "@/modules/cash/presentation/close-cash-session-action";
import {
  CloseCashSessionForm,
  type CloseCashSessionOption,
} from "@/modules/cash/presentation/close-cash-session-form";
import { listEventsUseCase } from "@/modules/events/application/list-events-use-case";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Fechar caixa | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function CloseCashPage() {
  const supabaseClient = await createSupabaseServerClient();
  const cashSessionClient =
    supabaseClient as unknown as SupabaseCashSessionClient;
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const eventClient = supabaseClient as unknown as SupabaseEventClient;
  const cashSessionClosingSummaryClient =
    supabaseClient as unknown as SupabaseCashSessionClosingSummaryClient;

  const [cashSessionsResult, eventsResult] = await Promise.all([
    listOpenCashSessionsUseCase({
      cashSessionRepository: new SupabaseCashSessionRepository(
        cashSessionClient,
      ),
      currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
        currentUserProfileClient,
      ),
    }),
    listEventsUseCase({
      eventRepository: new SupabaseEventRepository(eventClient),
    }),
  ]);

  const eventNames = new Map(
    eventsResult.success
      ? eventsResult.events.map((event) => [event.id, event.name])
      : [],
  );
  const closingSummariesResult = cashSessionsResult.success
    ? await listCashSessionClosingSummariesUseCase({
        cashSessionClosingSummaryRepository:
          new SupabaseCashSessionClosingSummaryRepository(
            cashSessionClosingSummaryClient,
          ),
        cashSessionIds: cashSessionsResult.sessions.map(
          (session) => session.id,
        ),
      })
    : ({
        summaries: [],
        success: true,
      } as const);
  const closingSummaries = new Map(
    closingSummariesResult.success
      ? closingSummariesResult.summaries.map((summary) => [
          summary.cashSessionId,
          summary,
        ])
      : [],
  );

  return (
    <PageShell>
      <PageHeader
        backLinks={[
          { href: "/", label: "Painel" },
          { href: "/cash/open", label: "Abrir caixa" },
        ]}
        description="Encerre o caixa aberto ao final do turno para travar novas movimentacoes nesse caixa."
        eyebrow="Caixa"
        title="Fechar caixa"
      />

      {!cashSessionsResult.success ? (
        <LoadErrorState
          actions={[{ href: "/cash/close", label: "Tentar novamente" }]}
          eyebrow="Erro"
          message={
            cashSessionsResult.formError ??
            "Verifique sua conexao e tente carregar os caixas abertos novamente."
          }
          title="Nao foi possivel carregar os caixas abertos"
        />
      ) : !closingSummariesResult.success ? (
        <LoadErrorState
          actions={[{ href: "/cash/close", label: "Tentar novamente" }]}
          eyebrow="Erro"
          message="A lista de caixas carregou, mas a conferencia financeira nao pode ser calculada agora."
          title="Nao foi possivel calcular a conferencia do caixa."
        />
      ) : cashSessionsResult.sessions.length === 0 ? (
        <EmptyState
          actions={[
            { href: "/cash/open", label: "Abrir caixa" },
            { href: "/pdv", label: "Ir ao PDV", variant: "secondary" },
          ]}
          eyebrow="Sem caixa aberto"
          message="Abra um caixa antes das vendas. Quando houver caixa aberto, ele aparecera aqui para conferencia e fechamento."
          title="Nenhum caixa aberto disponivel para fechamento."
        />
      ) : (
        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <CloseCashSessionForm
            action={closeCashSessionAction}
            sessions={cashSessionsResult.sessions.map((session) =>
              toCashSessionOption(session, eventNames, closingSummaries),
            )}
          />
        </section>
      )}
    </PageShell>
  );
}

function toCashSessionOption(
  session: CashSession,
  eventNames: Map<string, string>,
  closingSummaries: Map<string, CashSessionClosingSummary>,
): CloseCashSessionOption {
  const eventName = eventNames.get(session.eventId) ?? "Evento sem nome";
  const summary = closingSummaries.get(session.id) ?? {
    canceledSalesCount: 0,
    canceledSalesTotalInReais: 0,
    cashSessionId: session.id,
    completedSalesCount: 0,
    completedSalesTotalInReais: 0,
    expectedAmountInReais: session.openingAmountInReais,
    openingAmountInReais: session.openingAmountInReais,
  };

  return {
    canceledSalesCount: summary.canceledSalesCount,
    canceledSalesTotalInReais: summary.canceledSalesTotalInReais,
    completedSalesCount: summary.completedSalesCount,
    completedSalesTotalInReais: summary.completedSalesTotalInReais,
    expectedAmountInReais: summary.expectedAmountInReais,
    id: session.id,
    label: `${eventName} - aberto em ${dateTimeFormatter.format(
      session.openedAt,
    )}`,
    openingAmountInReais: summary.openingAmountInReais,
  };
}
