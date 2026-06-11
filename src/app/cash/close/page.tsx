import type { Metadata } from "next";
import Link from "next/link";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { listOpenCashSessionsUseCase } from "@/modules/cash/application/list-open-cash-sessions-use-case";
import type { CashSession } from "@/modules/cash/domain/cash-session";
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

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export default async function CloseCashPage() {
  const supabaseClient = await createSupabaseServerClient();
  const cashSessionClient =
    supabaseClient as unknown as SupabaseCashSessionClient;
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const eventClient = supabaseClient as unknown as SupabaseEventClient;

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
        ) : cashSessionsResult.sessions.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum caixa aberto disponivel para fechamento.
          </section>
        ) : (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <CloseCashSessionForm
              action={closeCashSessionAction}
              sessions={cashSessionsResult.sessions.map((session) =>
                toCashSessionOption(session, eventNames),
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
): CloseCashSessionOption {
  const eventName = eventNames.get(session.eventId) ?? "Evento sem nome";

  return {
    id: session.id,
    label: `${eventName} - aberto em ${dateTimeFormatter.format(
      session.openedAt,
    )} - inicial ${moneyFormatter.format(session.openingAmountInReais)}`,
  };
}
