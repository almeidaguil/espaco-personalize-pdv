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
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Estoque | Roberto Multimarcas",
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

  const result = await listProductsUseCase({
    productRepository,
  });

  const summaryResult = await listStockMovementsSummaryUseCase({
    productRepository,
    stockMovementRepository,
  });

  const activeProductOptions = result.success
    ? toActiveProductOptions(result.products)
    : [];

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Estoque" />

      <PageHeader
        description="Controle saldos, entradas e ajustes manuais dos produtos da loja."
        eyebrow="Estoque"
        title="Controle de estoque"
      />

      <Panel padding="sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent)]">
          Ajuste de estoque
        </p>

        <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--brand-foreground)]">
          Registrar movimentação
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-muted)]">
          Escolha um produto ativo e registre a entrada inicial ou um ajuste
          manual. A validação final acontece no servidor.
        </p>
      </Panel>

      {!result.success ? (
        <LoadErrorState
          actions={[
            {
              href: "/stock",
              label: "Tentar novamente",
            },
          ]}
          eyebrow="Erro"
          message={
            result.formError ??
            "Verifique sua conexão e tente carregar os produtos ativos novamente."
          }
          title="Não foi possível carregar os produtos"
        />
      ) : activeProductOptions.length === 0 ? (
        <EmptyState
          actions={[
            {
              href: "/products/new",
              label: "Cadastrar produto",
            },
            {
              href: "/products",
              label: "Ver produtos",
              variant: "secondary",
            },
          ]}
          eyebrow="Sem produto ativo"
          message="Cadastre ou ative um produto antes de ajustar o estoque."
          title="Estoque sem produto disponível."
        />
      ) : (
        <Panel>
          <StockAdjustmentForm
            action={adjustStockAction}
            products={activeProductOptions}
          />
        </Panel>
      )}

      {!summaryResult.success ? (
        <LoadErrorState
          actions={[
            {
              href: "/stock",
              label: "Tentar novamente",
            },
          ]}
          eyebrow="Erro"
          message={
            summaryResult.formError ??
            "Verifique sua conexão e tente carregar saldos e movimentações novamente."
          }
          title="Não foi possível carregar o estoque"
        />
      ) : (
        <StockMovementsOverview
          balances={summaryResult.balances}
          movements={summaryResult.movements}
        />
      )}
    </PageShell>
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
