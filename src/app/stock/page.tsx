import type { Metadata } from "next";
import Link from "next/link";

import { listProductsUseCase } from "@/modules/products/application/list-products-use-case";
import type { Product } from "@/modules/products/domain/product";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import { listStockMovementsSummaryUseCase } from "@/modules/stock/application/list-stock-movements-summary-use-case";
import {
  SupabaseStockMovementRepository,
  type SupabaseStockMovementClient,
} from "@/modules/stock/infra/supabase-stock-movement-repository";
import { adjustStockAction } from "@/modules/stock/presentation/adjust-stock-action";
import {
  StockAdjustmentForm,
  type StockAdjustmentProductOption,
} from "@/modules/stock/presentation/stock-adjustment-form";
import { StockMovementsOverview } from "@/modules/stock/presentation/stock-movements-overview";
import { AppHeader } from "@/shared/components/app-header";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Estoque | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const supabaseClient = await createSupabaseServerClient();
  const productRepository = new SupabaseProductRepository(
    supabaseClient as unknown as SupabaseProductClient,
  );
  const stockMovementClient =
    supabaseClient as unknown as SupabaseStockMovementClient;
  const stockMovementRepository = new SupabaseStockMovementRepository(
    stockMovementClient,
  );
  const result = await listProductsUseCase({ productRepository });
  const summaryResult = await listStockMovementsSummaryUseCase({
    productRepository,
    stockMovementRepository,
  });

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <AppHeader eyebrow="Modulo" title="Estoque" />

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Ajuste de estoque
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            Registrar movimentacao
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Escolha um produto ativo e registre a entrada inicial ou um ajuste
            manual. A validacao final acontece no servidor.
          </p>
        </section>

        {!result.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {result.formError}
          </section>
        ) : (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            {toActiveProductOptions(result.products).length === 0 ? (
              <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Cadastre ou ative um produto antes de ajustar o estoque.
                <Link
                  className="ml-1 font-semibold text-[#1e3275] underline-offset-2 hover:underline"
                  href="/products/new"
                >
                  Novo produto
                </Link>
              </div>
            ) : null}

            <StockAdjustmentForm
              action={adjustStockAction}
              products={toActiveProductOptions(result.products)}
            />
          </section>
        )}

        {!summaryResult.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {summaryResult.formError}
          </section>
        ) : (
          <StockMovementsOverview
            balances={summaryResult.balances}
            movements={summaryResult.movements}
          />
        )}
      </section>
    </main>
  );
}

function toActiveProductOptions(
  products: Product[],
): StockAdjustmentProductOption[] {
  return products
    .filter((product) => product.isActive)
    .map((product) => ({
      id: product.id,
      label: product.sku ? `${product.name} (${product.sku})` : product.name,
    }));
}
