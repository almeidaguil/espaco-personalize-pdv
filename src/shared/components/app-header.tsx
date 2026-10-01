"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/modules/auth/presentation/logout-action";
import { brand } from "@/shared/config/brand";

import { BrandLogo } from "./brand-logo";

const navigationItems = [
  { href: "/", label: "Painel" },
  { href: "/products", label: "Produtos" },
  { href: "/stock", label: "Estoque" },
  { href: "/events", label: "Eventos" },
  { href: "/cash/open", label: "Abrir caixa" },
  { href: "/cash/close", label: "Fechar caixa" },
  { href: "/pdv", label: "PDV" },
  { href: "/sales", label: "Vendas" },
  { href: "/reports", label: "Relatórios" },
] as const;

const primaryNavigationLabels = new Set(["Painel", "PDV", "Vendas"]);

type AppHeaderProps = {
  eyebrow?: string;
  showAdminNavigation?: boolean;
  title: string;
};

export function AppHeader({
  eyebrow = "Sistema de gestão",
  showAdminNavigation = false,
  title,
}: AppHeaderProps) {
  const pathname = usePathname();

  const visibleNavigationItems = showAdminNavigation
    ? [
        ...navigationItems,
        {
          href: "/settings",
          label: "Configurações",
        },
      ]
    : navigationItems;

  const primaryNavigationItems = visibleNavigationItems.filter((item) =>
    primaryNavigationLabels.has(item.label),
  );

  const secondaryNavigationItems = visibleNavigationItems.filter(
    (item) => !primaryNavigationLabels.has(item.label),
  );

  const hasActiveSecondaryItem = secondaryNavigationItems.some((item) =>
    isRouteActive(pathname, item.href),
  );

  return (
    <header className="relative rounded-2xl border border-white/10 bg-[var(--brand-primary)] px-4 py-3 text-white shadow-[0_14px_45px_rgba(0,0,0,0.12)] sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Marca */}
        <Link
          aria-label={`Ir para o painel de ${brand.name}`}
          className="group flex min-w-0 items-center gap-3"
          href="/"
        >
          <BrandLogo
            className="h-auto w-24 shrink-0 mix-blend-screen transition duration-200 group-hover:opacity-90 sm:w-28"
            priority
          />

          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)] sm:text-xs">
              {eyebrow}
            </p>

            <p className="mt-0.5 truncate text-base font-semibold text-white sm:text-lg">
              {title}
            </p>
          </div>
        </Link>

        {/* Navegação */}
        <nav
          aria-label="Navegação principal"
          className="flex w-full items-center gap-2 overflow-x-auto pb-1 lg:w-auto lg:overflow-visible lg:pb-0"
        >
          {primaryNavigationItems.map((item) => {
            const isActive = isRouteActive(pathname, item.href);

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "shrink-0 rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-3.5 py-2.5 text-sm font-bold text-[var(--brand-primary)] shadow-[0_8px_22px_rgba(205,163,79,0.16)] transition"
                    : "shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm font-semibold text-neutral-300 transition hover:border-[var(--brand-accent)]/50 hover:bg-white/[0.06] hover:text-[var(--brand-accent)]"
                }
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}

          {secondaryNavigationItems.length > 0 ? (
            <details className="group relative shrink-0">
              <summary
                className={
                  hasActiveSecondaryItem
                    ? "flex cursor-pointer list-none items-center gap-2 rounded-xl border border-[var(--brand-accent)]/60 bg-[var(--brand-accent)]/10 px-3.5 py-2.5 text-sm font-semibold text-[var(--brand-accent)] transition hover:bg-[var(--brand-accent)]/15 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/20 [&::-webkit-details-marker]:hidden"
                    : "flex cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm font-semibold text-neutral-300 transition hover:border-[var(--brand-accent)]/50 hover:bg-white/[0.06] hover:text-[var(--brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]/20 [&::-webkit-details-marker]:hidden"
                }
              >
                Mais opções
                <ChevronDownIcon />
              </summary>

              <div className="absolute right-0 top-full z-30 mt-2 grid w-56 gap-1 rounded-2xl border border-white/10 bg-[#111111] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
                {secondaryNavigationItems.map((item) => {
                  const isActive = isRouteActive(pathname, item.href);

                  return (
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={
                        isActive
                          ? "rounded-xl bg-[var(--brand-accent)] px-3 py-2.5 text-sm font-bold text-[var(--brand-primary)]"
                          : "rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/[0.06] hover:text-[var(--brand-accent)]"
                      }
                      href={item.href}
                      key={item.href}
                    >
                      {item.label}
                    </Link>
                  );
                })}

                {/* Logout */}
                <div className="my-1 border-t border-white/10" />

                <form action={logoutAction}>
                  <button
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                    type="submit"
                  >
                    <LogoutIcon />
                    Sair
                  </button>
                </form>
              </div>
            </details>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
