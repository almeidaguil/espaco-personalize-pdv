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

        <nav aria-label="Navegacao principal" className="flex flex-wrap gap-2">
          {visibleNavigationItems.map((item) => (
            <Link
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275]"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
