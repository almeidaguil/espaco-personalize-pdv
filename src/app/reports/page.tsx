import type { Metadata } from "next";

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
import { InlineFeedback } from "@/shared/components/inline-feedback";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
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
    <PageShell maxWidth="lg">
      <PageHeader
        description="Acompanhe vendas por evento, totais cancelados e produtos vendidos."
        eyebrow="Relatorios"
        title="Relatorios"
      />

      {!eventsResult.success ? (
        <InlineFeedback padding="md" tone="error">
          {eventsResult.formError}
        </InlineFeedback>
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
    </PageShell>
  );
}
