import Link from "next/link";
import type { ReactNode } from "react";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg";
};

const maxWidthClasses = {
  lg: "max-w-4xl",
  md: "max-w-3xl",
  sm: "max-w-md",
} as const;

export function PageShell({ children, maxWidth = "md" }: PageShellProps) {
  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section
        className={`mx-auto grid w-full ${maxWidthClasses[maxWidth]} gap-4`}
      >
        {children}
      </section>
    </main>
  );
}

type PageHeaderAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type PageHeaderBackLink = {
  href: string;
  label: string;
};

type PageHeaderProps = {
  actions?: PageHeaderAction[];
  backLinks?: PageHeaderBackLink[];
  description: string;
  eyebrow: string;
  title: string;
};

export function PageHeader({
  actions = [],
  backLinks = [{ href: "/", label: "Voltar ao painel" }],
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      {backLinks.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-3 text-sm font-semibold">
          {backLinks.map((link) => (
            <Link
              className="text-[#1e3275] transition hover:text-[#142456]"
              href={link.href}
              key={`${link.href}-${link.label}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>

        {actions.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {actions.map((action) => (
              <Link
                className={
                  action.variant === "secondary"
                    ? "rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275]"
                    : "rounded-md bg-[#f5c313] px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:bg-[#e7b80f]"
                }
                href={action.href}
                key={`${action.href}-${action.label}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
