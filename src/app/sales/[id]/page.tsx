import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSaleDetailUseCase } from "@/modules/sales/application/get-sale-detail-use-case";
import {
  SupabaseSaleDetailRepository,
  type SupabaseSaleDetailClient,
} from "@/modules/sales/infra/supabase-sale-detail-repository";
import { cancelSaleAction } from "@/modules/sales/presentation/cancel-sale-action";
import { CancelSaleForm } from "@/modules/sales/presentation/cancel-sale-form";
import { SaleDetailCard } from "@/modules/sales/presentation/sale-detail-card";
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
      <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
        <section className="mx-auto grid w-full max-w-3xl gap-4">
          <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <Link
              className="mb-3 inline-flex text-sm font-semibold text-[#1e3275] transition hover:text-[#142456]"
              href="/sales"
            >
              Voltar para vendas
            </Link>
            <h1 className="text-2xl font-semibold">Detalhe da venda</h1>
          </header>
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Nao foi possivel carregar a venda.
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            className="mb-3 inline-flex text-sm font-semibold text-[#1e3275] transition hover:text-[#142456]"
            href="/sales"
          >
            Voltar para vendas
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Venda
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Detalhe da venda</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Consulte os itens vendidos, pagamento e troco registrado.
          </p>
        </header>

        <SaleDetailCard sale={result.sale} />
        <CancelSaleForm
          action={cancelSaleAction}
          isCanceled={result.sale.status === "canceled"}
          saleId={result.sale.id}
        />
      </section>
    </main>
  );
}
