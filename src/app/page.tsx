const summaryCards = [
  ["Vendas hoje", "R$ 0,00"],
  ["Evento ativo", "Nao definido"],
  ["Caixa", "Fechado"],
] as const;

const modules = [
  ["Produtos", "Cadastro e estoque inicial"],
  ["Eventos", "Preparacao das vendas presenciais"],
  ["PDV", "Carrinho e finalizacao"],
  ["Caixa", "Abertura e fechamento"],
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              Espaco Personalize
            </p>
            <h1 className="text-xl font-semibold">PDV</h1>
          </div>
          <span className="rounded-md bg-[#f5c313] px-3 py-2 text-sm font-semibold text-[#1e3275]">
            MVP
          </span>
        </header>

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
          {modules.map(([title, description]) => (
            <article
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
              key={title}
            >
              <h2 className="text-lg font-semibold text-[#1e3275]">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
