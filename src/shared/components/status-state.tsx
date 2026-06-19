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
    border: "border-slate-200",
    eyebrow: "text-[#1e3275]",
    panel: "bg-white",
    title: "text-slate-950",
  },
  error: {
    border: "border-red-200",
    eyebrow: "text-red-700",
    panel: "bg-red-50",
    title: "text-red-950",
  },
  warning: {
    border: "border-amber-200",
    eyebrow: "text-[#1e3275]",
    panel: "bg-amber-50",
    title: "text-slate-950",
  },
};

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
      className={`rounded-md border ${classes.border} ${classes.panel} p-5 shadow-sm`}
      role={tone === "error" ? "alert" : undefined}
    >
      {eyebrow ? (
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${classes.eyebrow}`}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`mt-1 text-lg font-semibold ${classes.title}`}>{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{message}</p>
      {children ? <div className="mt-3">{children}</div> : null}
      {actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              className={
                action.variant === "secondary"
                  ? "inline-flex min-h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275]"
                  : "inline-flex min-h-10 items-center justify-center rounded-md bg-[#1e3275] px-4 text-sm font-semibold text-white transition hover:bg-[#17275c]"
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
