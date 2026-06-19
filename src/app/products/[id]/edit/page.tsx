import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductByIdUseCase } from "@/modules/products/application/get-product-by-id-use-case";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import { ProductForm } from "@/modules/products/presentation/product-form";
import { createProductFormValuesFromProduct } from "@/modules/products/presentation/product-form-data";
import { updateProductAction } from "@/modules/products/presentation/update-product-action";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "Editar produto | Espaco Personalize PDV",
};

type EditProductPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;
  const supabaseClient = await createSupabaseServerClient();
  const productRepository = new SupabaseProductRepository(
    supabaseClient as unknown as SupabaseProductClient,
  );
  const result = await getProductByIdUseCase(id, {
    productRepository,
  });

  if (!result.success) {
    if (result.error === "not_found") {
      notFound();
    }

    return (
      <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
        <section className="mx-auto grid w-full max-w-md gap-4">
          <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap gap-3 text-sm font-semibold">
              <Link
                className="text-[#1e3275] transition hover:text-[#142456]"
                href="/"
              >
                Painel
              </Link>
              <Link
                className="text-[#1e3275] transition hover:text-[#142456]"
                href="/products"
              >
                Produtos
              </Link>
            </div>
            <h1 className="text-2xl font-semibold">Editar produto</h1>
          </header>

          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Nao foi possivel carregar o produto.
          </section>
        </section>
      </main>
    );
  }

  const action = updateProductAction.bind(null, result.product.id);

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-md gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-3 text-sm font-semibold">
            <Link
              className="text-[#1e3275] transition hover:text-[#142456]"
              href="/"
            >
              Painel
            </Link>
            <Link
              className="text-[#1e3275] transition hover:text-[#142456]"
              href="/products"
            >
              Produtos
            </Link>
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Produtos
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Editar produto</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Atualize nome, preco, SKU e status do produto selecionado.
          </p>
        </header>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <ProductForm
            action={action}
            initialValues={createProductFormValuesFromProduct({
              isActive: result.product.isActive,
              name: result.product.name,
              priceInReais: result.product.price.toReais(),
              sku: result.product.sku,
            })}
            submitLabel="Salvar alteracoes"
          />
        </section>
      </section>
    </main>
  );
}
