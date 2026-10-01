import Link from "next/link";
import type { ReactNode } from "react";

import { Panel } from "./panel";

type PageShellProps = {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
};

const maxWidthClasses = {
  sm: "max-w-md",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
} as const;

export function PageShell({ children, maxWidth = "md" }: PageShellProps) {
  return (
    <main className="min-h-[100dvh] bg-[var(--brand-background)] px-4 py-5 text-[var(--brand-foreground)] sm:px-6 sm:py-6">
      <section
        className={`mx-auto grid w-full ${maxWidthClasses[maxWidth]} gap-5`}
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
  backLinks = [],
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <Panel as="header" padding="sm">
      {backLinks.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-3">
          {backLinks.map((link) => (
            <Link
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-muted)] transition hover:text-[var(--brand-accent-foreground)]"
              href={link.href}
              key={`${link.href}-${link.label}`}
            >
              <span aria-hidden="true">←</span>
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent-foreground)]">
            {eyebrow}
          </p>

          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--brand-foreground)]">
            {title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-muted)]">
            {description}
          </p>
        </div>

        {actions.length > 0 ? (
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {actions.map((action) => (
              <Link
                className={
                  action.variant === "secondary"
                    ? "inline-flex min-h-10 items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)]"
                    : "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-4 py-2 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105"
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
    </Panel>
  );
}
