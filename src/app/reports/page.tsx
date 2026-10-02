import type { Metadata } from "next";

import { getSalesReportUseCase } from "@/modules/reports/application/get-sales-report-use-case";
import type { SalesReportFilters } from "@/modules/reports/application/sales-report-repository";
import {
  SupabaseSalesReportRepository,
  type SupabaseSalesReportClient,
} from "@/modules/reports/infra/supabase-sales-report-repository";
import { SalesReport } from "@/modules/reports/presentation/sales-report";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { brand } from "@/shared/config/brand";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: `Relatórios | ${brand.name}`,
};

export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: Promise<{
    cashSessionId?: string;
    endDate?: string;
    itemsPage?: string;
    operatorId?: string;
    sessionsPage?: string;
    startDate?: string;
  }>;
};

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps = {}) {
  const resolvedSearchParams = await searchParams;
  const currentBusinessDate = getSaoPauloBusinessDate();
  const filters: SalesReportFilters = {
    cashSessionId: resolvedSearchParams?.cashSessionId,
    endDate: resolvedSearchParams?.endDate ?? currentBusinessDate,
    itemsPage: Number(resolvedSearchParams?.itemsPage ?? 1),
    operatorId: resolvedSearchParams?.operatorId,
    pageSize: 8,
    sessionsPage: Number(resolvedSearchParams?.sessionsPage ?? 1),
    startDate: resolvedSearchParams?.startDate ?? currentBusinessDate,
  };
  const supabaseClient = await createSupabaseServerClient();
  const reportResult = await getSalesReportUseCase({
    filters,
    salesReportRepository: new SupabaseSalesReportRepository(
      supabaseClient as unknown as SupabaseSalesReportClient,
    ),
  });

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Relatórios" />

      <PageHeader
        description="Acompanhe vendas, pagamentos, produtos e divergências por período, vendedor e sessão de caixa."
        eyebrow="Relatórios"
        title="Relatórios"
      />

      <SalesReport
        errorMessage={
          !reportResult.success && "formError" in reportResult
            ? reportResult.formError
            : undefined
        }
        filters={filters}
        report={
          reportResult.success && !("formError" in reportResult)
            ? reportResult.report
            : null
        }
      />
    </PageShell>
  );
}

function getSaoPauloBusinessDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}
