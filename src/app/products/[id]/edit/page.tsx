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
import { InlineFeedback } from "@/shared/components/inline-feedback";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
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

        <InlineFeedback padding="md" tone="error">
          Nao foi possivel carregar o produto.
        </InlineFeedback>
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

      <Panel>
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
      </Panel>
    </PageShell>
  );
}
