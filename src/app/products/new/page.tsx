import type { Metadata } from "next";

import { createProductAction } from "@/modules/products/presentation/create-product-action";
import { ProductForm } from "@/modules/products/presentation/product-form";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";

export const metadata: Metadata = {
  title: "Novo produto | Roberto Multimarcas",
};

export default function NewProductPage() {
  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Novo produto" />

      <section className="mx-auto grid w-full max-w-3xl gap-5">
        <PageHeader
          backLinks={[
            {
              href: "/products",
              label: "Voltar para produtos",
            },
          ]}
          description="Cadastre um novo item para venda e controle de estoque."
          eyebrow="Cadastro"
          title="Novo produto"
        />

        <Panel>
          <ProductForm action={createProductAction} />
        </Panel>
      </section>
    </PageShell>
  );
}
