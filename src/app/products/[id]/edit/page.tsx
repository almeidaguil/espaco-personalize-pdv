import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProductByIdUseCase } from "@/modules/products/application/get-product-by-id-use-case";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import { ProductForm } from "@/modules/products/presentation/product-form";
import { createProductFormValuesFromProduct } from "@/modules/products/presentation/product-form-data";
import { updateProductAction } from "@/modules/products/presentation/update-product-action";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
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
      <PageShell maxWidth="sm">
        <PageHeader
          backLinks={[
            { href: "/", label: "Painel" },
            { href: "/products", label: "Produtos" },
          ]}
          description="Atualize nome, preco, SKU e status do produto selecionado."
          eyebrow="Produtos"
          title="Editar produto"
        />

        <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Nao foi possivel carregar o produto.
        </section>
      </PageShell>
    );
  }

  const action = updateProductAction.bind(null, result.product.id);

  return (
    <PageShell maxWidth="sm">
      <PageHeader
        backLinks={[
          { href: "/", label: "Painel" },
          { href: "/products", label: "Produtos" },
        ]}
        description="Atualize nome, preco, SKU e status do produto selecionado."
        eyebrow="Produtos"
        title="Editar produto"
      />

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
    </PageShell>
  );
}
