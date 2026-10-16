import type { ReactNode } from "react";

type StatusBadgeTone = "neutral" | "success" | "warning" | "danger";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
  showDot?: boolean;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral:
    "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--brand-muted)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  warning:
    "border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 text-[var(--brand-accent-foreground)]",
};

export function StatusBadge({
  children,
  tone = "neutral",
  showDot = false,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  );
}
