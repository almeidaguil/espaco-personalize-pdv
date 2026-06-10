import type { Metadata } from "next";
import Link from "next/link";

import { listProductsUseCase } from "@/modules/products/application/list-products-use-case";
import type { Product } from "@/modules/products/domain/product";
import { SupabaseProductRepository } from "@/modules/products/infra/supabase-product-repository";
import {
  ProductList,
  type ProductListItem,
} from "@/modules/products/presentation/product-list";
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
  const productRepository = new SupabaseProductRepository(supabaseClient);
  const result = await listProductsUseCase({ productRepository });

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
                Cadastro
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Produtos</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Consulte os produtos disponiveis para venda nos eventos.
              </p>
            </div>
            <Link
              className="rounded-md bg-[#f5c313] px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:bg-[#e7b80f]"
              href="/products/new"
            >
              Novo
            </Link>
          </div>
        </header>

        {!result.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {result.formError}
          </section>
        ) : result.products.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum produto cadastrado ainda.
          </section>
        ) : (
          <ProductList products={result.products.map(toProductListItem)} />
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
