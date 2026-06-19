import type { Metadata } from "next";
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
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
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
          <LoadErrorState
            actions={[{ href: "/stock", label: "Tentar novamente" }]}
            eyebrow="Erro"
            message={
              result.formError ??
              "Verifique sua conexao e tente carregar os produtos ativos novamente."
            }
            title="Nao foi possivel carregar os produtos"
          />
        ) : toActiveProductOptions(result.products).length === 0 ? (
          <EmptyState
            actions={[
              { href: "/products/new", label: "Cadastrar produto" },
              {
                href: "/products",
                label: "Ver produtos",
                variant: "secondary",
              },
            ]}
            eyebrow="Sem produto ativo"
            message="Cadastre ou ative um produto antes de ajustar o estoque."
            title="Estoque sem produto disponivel."
          />
        ) : (
          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <StockAdjustmentForm
              action={adjustStockAction}
              products={toActiveProductOptions(result.products)}
            />
          </section>
        )}

        {!summaryResult.success ? (
          <LoadErrorState
            actions={[{ href: "/stock", label: "Tentar novamente" }]}
            eyebrow="Erro"
            message={
              summaryResult.formError ??
              "Verifique sua conexao e tente carregar saldos e movimentacoes novamente."
            }
            title="Nao foi possivel carregar o estoque"
          />
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
