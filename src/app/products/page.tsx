import type { Metadata } from "next";
import Link from "next/link";

import { listProductsUseCase } from "@/modules/products/application/list-products-use-case";
import type { Product } from "@/modules/products/domain/product";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import { type ProductListItem } from "@/modules/products/presentation/product-list";
import { ProductCatalog } from "@/modules/products/presentation/product-catalog";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Produtos | Espaco Personalize PDV",
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
  const result = await listProductsUseCase({ productRepository });

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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
                Cadastro
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Produtos</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Consulte e ajuste os produtos disponiveis para venda nos
                eventos.
              </p>
            </div>
            <Link
              className="rounded-md bg-[#f5c313] px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:bg-[#e7b80f]"
              href="/products/new"
            >
              Novo produto
            </Link>
          </div>
        </header>

        {!result.success ? (
          <LoadErrorState
            actions={[{ href: "/products", label: "Tentar novamente" }]}
            eyebrow="Erro"
            message={
              result.formError ??
              "Verifique sua conexao e tente carregar a lista novamente."
            }
            title="Nao foi possivel carregar os produtos"
          />
        ) : result.products.length === 0 ? (
          <EmptyState
            actions={[{ href: "/products/new", label: "Cadastrar produto" }]}
            eyebrow="Sem produtos"
            message="Cadastre o primeiro produto para liberar estoque, PDV e vendas."
            title="Nenhum produto cadastrado ainda."
          />
        ) : (
          <ProductCatalog products={result.products.map(toProductListItem)} />
        )}
      </section>
    </main>
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
