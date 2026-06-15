import type { Metadata } from "next";
import Link from "next/link";

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
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
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
              href="/cash/open"
            >
              Abrir caixa
            </Link>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Caixa
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Fechar caixa</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Encerre o caixa aberto ao final do turno para travar novas
            movimentacoes nesse caixa.
          </p>
        </header>

        {!cashSessionsResult.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {cashSessionsResult.formError}
          </section>
        ) : !closingSummariesResult.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Nao foi possivel calcular a conferencia do caixa.
          </section>
        ) : cashSessionsResult.sessions.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum caixa aberto disponivel para fechamento.
          </section>
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
      </section>
    </main>
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
