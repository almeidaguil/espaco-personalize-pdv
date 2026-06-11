import type { Metadata } from "next";
import Link from "next/link";

import { createProductAction } from "@/modules/products/presentation/create-product-action";
import { ProductForm } from "@/modules/products/presentation/product-form";

export const metadata: Metadata = {
  title: "Novo produto | Espaco Personalize PDV",
};

export default function NewProductPage() {
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
          <h1 className="mt-1 text-2xl font-semibold">Novo produto</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Cadastre produtos para venda nos eventos presenciais.
          </p>
        </header>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <ProductForm action={createProductAction} />
        </section>
      </section>
    </main>
  );
}
