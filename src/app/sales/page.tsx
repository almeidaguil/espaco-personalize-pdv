import type { Metadata } from "next";

import { listSalesUseCase } from "@/modules/sales/application/list-sales-use-case";
import {
  SupabaseSaleSummaryRepository,
  type SupabaseSaleSummaryClient,
} from "@/modules/sales/infra/supabase-sale-summary-repository";
import { SalesList } from "@/modules/sales/presentation/sales-list";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { LoadErrorState } from "@/shared/components/status-state";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Vendas | Espaco Personalize PDV",
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
    <PageShell>
      <PageHeader
        description="Consulte as vendas registradas e acompanhe o total por operacao."
        eyebrow="Vendas"
        title="Vendas"
      />

      {!result.success ? (
        <LoadErrorState
          actions={[{ href: "/sales", label: "Tentar novamente" }]}
          eyebrow="Erro"
          message="Verifique sua conexao e tente carregar o historico novamente."
          title="Nao foi possivel carregar as vendas."
        />
      ) : (
        <SalesList sales={result.sales} />
      )}
    </PageShell>
  );
}
