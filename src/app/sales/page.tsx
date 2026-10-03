import type { Metadata } from "next";

import { listSalesHistoryUseCase } from "@/modules/sales/application/list-sales-history-use-case";
import {
  SupabaseSaleSummaryRepository,
  type SupabaseSaleSummaryClient,
} from "@/modules/sales/infra/supabase-sale-summary-repository";
import { SalesList } from "@/modules/sales/presentation/sales-list";
import { SalesHistoryFilters } from "@/modules/sales/presentation/sales-history-filters";
import { InlineFeedback } from "@/shared/components/inline-feedback";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { LoadErrorState } from "@/shared/components/status-state";
import { brand } from "@/shared/config/brand";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: `Vendas | ${brand.name}`,
};

export const dynamic = "force-dynamic";

type SalesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SalesPage({ searchParams }: SalesPageProps = {}) {
  const query = (await searchParams) ?? {};
  const filterFields = Object.fromEntries(
    Object.entries(query).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const supabaseClient = await createSupabaseServerClient();

  const result = await listSalesHistoryUseCase({
    filters: { ...query, pageSize: 8 },
    salesHistoryRepository: new SupabaseSaleSummaryRepository(
      supabaseClient as unknown as SupabaseSaleSummaryClient,
    ),
  });

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Vendas" />

      <PageHeader
        description="Consulte as vendas registradas, acompanhe valores e acesse os detalhes de cada operação."
        eyebrow="Vendas"
        title="Vendas"
      />

      <SalesHistoryFilters
        filters={filterFields}
        options={
          result.success ? result.options : { operators: [], sessions: [] }
        }
      />

      {!result.success && result.error === "invalid_filters" ? (
        <InlineFeedback padding="md" tone="error">
          {result.formError}
        </InlineFeedback>
      ) : !result.success ? (
        <LoadErrorState
          actions={[
            {
              href: "/sales",
              label: "Tentar novamente",
            },
          ]}
          eyebrow="Erro"
          message="Verifique sua conexão e tente carregar o histórico novamente."
          title="Não foi possível carregar as vendas"
        />
      ) : (
        <SalesList
          sales={result.sales}
          totalCount={result.totalCount}
          filters={result.filters}
        />
      )}
    </PageShell>
  );
}
