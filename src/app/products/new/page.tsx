import type { Metadata } from "next";

import { createProductAction } from "@/modules/products/presentation/create-product-action";
import { ProductForm } from "@/modules/products/presentation/product-form";
import { PageHeader, PageShell } from "@/shared/components/page-shell";

export const metadata: Metadata = {
  title: "Novo produto | Espaco Personalize PDV",
};

export default function NewProductPage() {
  return (
    <PageShell maxWidth="sm">
      <PageHeader
        backLinks={[
          { href: "/", label: "Painel" },
          { href: "/products", label: "Produtos" },
        ]}
        description="Cadastre produtos para venda nos eventos presenciais."
        eyebrow="Produtos"
        title="Novo produto"
      />

      <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <ProductForm action={createProductAction} />
      </section>
    </PageShell>
  );
}
