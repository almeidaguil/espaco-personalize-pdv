import Link from "next/link";

type ModulePlaceholderProps = {
  description: string;
  nextStep: string;
  title: string;
};

export function ModulePlaceholder({
  description,
  nextStep,
  title,
}: ModulePlaceholderProps) {
  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Modulo
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </header>

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-950">
            Em desenvolvimento
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{nextStep}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              className="rounded-md bg-[#f5c313] px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:bg-[#e7b80f]"
              href="/"
            >
              Voltar ao painel
            </Link>
            <Link
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
              href="/products"
            >
              Ver produtos
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
