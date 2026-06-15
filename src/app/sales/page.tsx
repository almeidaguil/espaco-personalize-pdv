import type { Metadata } from "next";
import Link from "next/link";

import { listSalesUseCase } from "@/modules/sales/application/list-sales-use-case";
import {
  SupabaseSaleSummaryRepository,
  type SupabaseSaleSummaryClient,
} from "@/modules/sales/infra/supabase-sale-summary-repository";
import { SalesList } from "@/modules/sales/presentation/sales-list";
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
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            className="mb-3 inline-flex text-sm font-semibold text-[#1e3275] transition hover:text-[#142456]"
            href="/"
          >
            Voltar ao painel
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Vendas
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Vendas</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Consulte as vendas registradas e acompanhe o total por operacao.
          </p>
        </header>

        {!result.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Nao foi possivel carregar as vendas.
          </section>
        ) : (
          <SalesList sales={result.sales} />
        )}
      </section>
    </main>
  );
}
