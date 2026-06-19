import type { Metadata } from "next";
import Link from "next/link";

import { listEventsUseCase } from "@/modules/events/application/list-events-use-case";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import { getSalesByEventReportUseCase } from "@/modules/reports/application/get-sales-by-event-report-use-case";
import {
  SupabaseSalesByEventReportRepository,
  type SupabaseSalesByEventReportClient,
} from "@/modules/reports/infra/supabase-sales-by-event-report-repository";
import { SalesByEventReport } from "@/modules/reports/presentation/sales-by-event-report";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Relatorios | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: Promise<{
    eventId?: string;
  }>;
};

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps = {}) {
  const resolvedSearchParams = await searchParams;
  const supabaseClient = await createSupabaseServerClient();
  const eventClient = supabaseClient as unknown as SupabaseEventClient;
  const reportClient =
    supabaseClient as unknown as SupabaseSalesByEventReportClient;

  const eventsResult = await listEventsUseCase({
    eventRepository: new SupabaseEventRepository(eventClient),
  });
  const events = eventsResult.success ? eventsResult.events : [];
  const selectedEventId = resolvedSearchParams?.eventId ?? events[0]?.id ?? "";
  const reportResult = selectedEventId
    ? await getSalesByEventReportUseCase({
        eventId: selectedEventId,
        salesByEventReportRepository: new SupabaseSalesByEventReportRepository(
          reportClient,
        ),
      })
    : null;

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-4xl gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            className="mb-3 inline-flex text-sm font-semibold text-[#1e3275] transition hover:text-[#142456]"
            href="/"
          >
            Voltar ao painel
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Relatorios
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Relatorios</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Acompanhe vendas por evento, totais cancelados e produtos vendidos.
          </p>
        </header>

        {!eventsResult.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {eventsResult.formError}
          </section>
        ) : (
          <SalesByEventReport
            events={events}
            report={
              reportResult?.success && !("formError" in reportResult)
                ? reportResult.report
                : null
            }
            selectedEventId={selectedEventId}
          />
        )}
      </section>
    </main>
  );
}
