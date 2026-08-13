import Link from "next/link";

import { BrandLogo } from "./brand-logo";

const navigationItems = [
  { href: "/", label: "Painel" },
  { href: "/products", label: "Produtos" },
  { href: "/events", label: "Eventos" },
  { href: "/stock", label: "Estoque" },
  { href: "/cash/open", label: "Abrir caixa" },
  { href: "/cash/close", label: "Fechar caixa" },
  { href: "/pdv", label: "PDV" },
  { href: "/sales", label: "Vendas" },
] as const;

const primaryNavigationLabels = new Set(["Painel", "PDV", "Vendas"]);

type AppHeaderProps = {
  eyebrow?: string;
  showAdminNavigation?: boolean;
  title: string;
};

export function AppHeader({
  eyebrow = "Espaco Personalize",
  showAdminNavigation = false,
  title,
}: AppHeaderProps) {
  const visibleNavigationItems = showAdminNavigation
    ? [...navigationItems, { href: "/settings", label: "Configuracoes" }]
    : navigationItems;
  const primaryNavigationItems = visibleNavigationItems.filter((item) =>
    primaryNavigationLabels.has(item.label),
  );
  const secondaryNavigationItems = visibleNavigationItems.filter(
    (item) => !primaryNavigationLabels.has(item.label),
  );

  return (
    <header className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link className="flex items-center gap-3" href="/">
          <BrandLogo className="h-auto w-16" priority />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              {eyebrow}
            </p>
            <h1 className="text-xl font-semibold">{title}</h1>
          </div>
        </Link>

        <nav
          aria-label="Navegacao principal"
          className="flex flex-wrap items-center gap-2"
        >
          {primaryNavigationItems.map((item) => (
            <Link
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
          {secondaryNavigationItems.length > 0 ? (
            <details className="group relative">
              <summary className="list-none rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:cursor-pointer hover:border-[#1e3275] hover:text-[#1e3275] focus:outline-none focus:ring-2 focus:ring-[#1e3275]/15 [&::-webkit-details-marker]:hidden">
                Mais opcoes
              </summary>
              <div className="mt-2 grid min-w-44 gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-sm sm:absolute sm:right-0 sm:z-20">
                {secondaryNavigationItems.map((item) => (
                  <Link
                    className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-[#1e3275]"
                    href={item.href}
                    key={item.href}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
