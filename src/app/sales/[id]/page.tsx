import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getSaleDetailUseCase } from "@/modules/sales/application/get-sale-detail-use-case";
import {
  SupabaseSaleDetailRepository,
  type SupabaseSaleDetailClient,
} from "@/modules/sales/infra/supabase-sale-detail-repository";
import { cancelSaleAction } from "@/modules/sales/presentation/cancel-sale-action";
import { CancelSaleForm } from "@/modules/sales/presentation/cancel-sale-form";
import { SaleDetailCard } from "@/modules/sales/presentation/sale-detail-card";
import { InlineFeedback } from "@/shared/components/inline-feedback";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Detalhe da venda | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

type SaleDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function SaleDetailsPage({
  params,
}: SaleDetailsPageProps) {
  const { id } = await params;
  const supabaseClient = await createSupabaseServerClient();
  const result = await getSaleDetailUseCase(id, {
    saleDetailRepository: new SupabaseSaleDetailRepository(
      supabaseClient as unknown as SupabaseSaleDetailClient,
    ),
  });

  if (!result.success) {
    if (result.error === "not_found") {
      notFound();
    }

    return (
      <PageShell>
        <PageHeader
          backLinks={[{ href: "/sales", label: "Voltar para vendas" }]}
          description="Consulte os itens vendidos, pagamento e troco registrado."
          eyebrow="Venda"
          title="Detalhe da venda"
        />
        <InlineFeedback padding="md" tone="error">
          Nao foi possivel carregar a venda.
        </InlineFeedback>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        backLinks={[{ href: "/sales", label: "Voltar para vendas" }]}
        description="Consulte os itens vendidos, pagamento e troco registrado."
        eyebrow="Venda"
        title="Detalhe da venda"
      />

      <SaleDetailCard sale={result.sale} />
      <CancelSaleForm
        action={cancelSaleAction}
        isCanceled={result.sale.status === "canceled"}
        saleId={result.sale.id}
      />
    </PageShell>
  );
}
