import type { Metadata } from "next";

import { listSalesUseCase } from "@/modules/sales/application/list-sales-use-case";
import {
  SupabaseSaleSummaryRepository,
  type SupabaseSaleSummaryClient,
} from "@/modules/sales/infra/supabase-sale-summary-repository";
import { SalesList } from "@/modules/sales/presentation/sales-list";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { LoadErrorState } from "@/shared/components/status-state";
import { brand } from "@/shared/config/brand";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: `Vendas | ${brand.name}`,
};

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const supabaseClient = await createSupabaseServerClient();

  const result = await listSalesUseCase({
    saleSummaryRepository: new SupabaseSaleSummaryRepository(
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

      {!result.success ? (
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
        <SalesList sales={result.sales} />
      )}
    </PageShell>
  );
}
