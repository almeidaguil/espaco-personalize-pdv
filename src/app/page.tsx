import Link from "next/link";

import { AppHeader } from "@/shared/components/app-header";

const summaryCards = [
  ["Vendas hoje", "R$ 0,00"],
  ["Evento ativo", "Nao definido"],
  ["Caixa", "Fechado"],
] as const;

const modules = [
  {
    description: "Cadastro, consulta e preparacao para venda.",
    href: "/products",
    status: "Disponivel",
    title: "Produtos",
  },
  {
    description: "Ajustes iniciais e manuais por movimentacao.",
    href: "/stock",
    status: "Disponivel",
    title: "Estoque",
  },
  {
    description: "Preparacao das vendas presenciais.",
    href: "/events",
    status: "Disponivel",
    title: "Eventos",
  },
  {
    description: "Selecao de evento e verificacao de caixa aberto.",
    href: "/pdv",
    status: "Parcial",
    title: "PDV",
  },
  {
    description: "Abertura, fechamento e turnos de evento.",
    href: "/cash/open",
    status: "Disponivel",
    title: "Caixa",
  },
  {
    description: "Vendas registradas e exportacoes.",
    href: "/reports",
    status: "Em breve",
    title: "Relatorios",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader title="PDV" />

        <div className="grid gap-3 sm:grid-cols-3">
          {summaryCards.map(([label, value]) => (
            <article
              className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
              key={label}
            >
              <p className="text-sm text-slate-500">{label}</p>
              <strong className="mt-2 block text-lg text-slate-950">
                {value}
              </strong>
            </article>
          ))}
        </div>

        <section className="grid flex-1 gap-3 sm:grid-cols-2">
          {modules.map((module) => (
            <Link
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1e3275] hover:shadow-md"
              href={module.href}
              key={module.title}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#1e3275]">
                  {module.title}
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {module.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {module.description}
              </p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}
