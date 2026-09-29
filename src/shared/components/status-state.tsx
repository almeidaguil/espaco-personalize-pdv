import Link from "next/link";
import type { ReactNode } from "react";

type StatusStateAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type StatusStateProps = {
  actions?: StatusStateAction[];
  children?: ReactNode;
  eyebrow?: string;
  message: string;
  title: string;
  tone?: "empty" | "error" | "warning";
};

const toneClasses = {
  empty: {
    border: "border-[var(--border)]",
    eyebrow: "text-[var(--brand-accent)]",
    panel: "bg-[var(--brand-surface)]",
    title: "text-[var(--brand-foreground)]",
    message: "text-[var(--brand-muted)]",
  },
  error: {
    border: "border-red-200",
    eyebrow: "text-red-700",
    panel: "bg-red-50",
    title: "text-red-950",
    message: "text-red-800",
  },
  warning: {
    border: "border-amber-200",
    eyebrow: "text-amber-700",
    panel: "bg-amber-50",
    title: "text-amber-950",
    message: "text-amber-900",
  },
} as const;

export function StatusState({
  actions = [],
  children,
  eyebrow,
  message,
  title,
  tone = "empty",
}: StatusStateProps) {
  const classes = toneClasses[tone];

  return (
    <section
      aria-live={tone === "error" ? "polite" : undefined}
      className={`rounded-2xl border ${classes.border} ${classes.panel} p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]`}
      role={tone === "error" ? "alert" : undefined}
    >
      {eyebrow ? (
        <p
          className={`text-xs font-bold uppercase tracking-[0.16em] ${classes.eyebrow}`}
        >
          {eyebrow}
        </p>
      ) : null}

      <h2 className={`mt-1.5 text-lg font-bold ${classes.title}`}>{title}</h2>

      <p className={`mt-2 text-sm leading-6 ${classes.message}`}>{message}</p>

      {children ? <div className="mt-3">{children}</div> : null}

      {actions.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              className={
                action.variant === "secondary"
                  ? "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent)]"
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
    </section>
  );
}

type EmptyStateProps = Omit<StatusStateProps, "tone">;

export function EmptyState(props: EmptyStateProps) {
  return <StatusState {...props} tone="empty" />;
}

type LoadErrorStateProps = Omit<StatusStateProps, "tone">;

export function LoadErrorState(props: LoadErrorStateProps) {
  return <StatusState {...props} tone="error" />;
}
