import type { Metadata } from "next";

import { listProductsUseCase } from "@/modules/products/application/list-products-use-case";
import type { Product } from "@/modules/products/domain/product";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import { ProductCatalog } from "@/modules/products/presentation/product-catalog";
import type { ProductListItem } from "@/modules/products/presentation/product-list";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
import { brand } from "@/shared/config/brand";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: `Produtos | ${brand.name}`,
};

export const dynamic = "force-dynamic";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export default async function ProductsPage() {
  const supabaseClient = await createSupabaseServerClient();

  const productRepository = new SupabaseProductRepository(
    supabaseClient as unknown as SupabaseProductClient,
  );

  const result = await listProductsUseCase({
    productRepository,
  });

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Produtos" />

      <PageHeader
        actions={[
          {
            href: "/products/new",
            label: "Novo produto",
          },
        ]}
        description="Consulte e ajuste os produtos disponíveis para venda."
        eyebrow="Cadastro"
        title="Produtos"
      />

      {!result.success ? (
        <LoadErrorState
          actions={[
            {
              href: "/products",
              label: "Tentar novamente",
            },
          ]}
          eyebrow="Erro"
          message={
            result.formError ??
            "Verifique sua conexão e tente carregar a lista novamente."
          }
          title="Não foi possível carregar os produtos"
        />
      ) : result.products.length === 0 ? (
        <EmptyState
          actions={[
            {
              href: "/products/new",
              label: "Cadastrar produto",
            },
          ]}
          eyebrow="Sem produtos"
          message="Cadastre o primeiro produto para liberar estoque, PDV e vendas."
          title="Nenhum produto cadastrado ainda."
        />
      ) : (
        <ProductCatalog products={result.products.map(toProductListItem)} />
      )}
    </PageShell>
  );
}

function toProductListItem(product: Product): ProductListItem {
  return {
    id: product.id,
    isActive: product.isActive,
    name: product.name,
    priceLabel: brlFormatter.format(product.price.toReais()),
    sku: product.sku ?? null,
  };
}
