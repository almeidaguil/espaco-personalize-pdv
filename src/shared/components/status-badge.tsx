import type { ReactNode } from "react";

type StatusBadgeTone = "neutral" | "success" | "warning";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

const toneClasses: Record<StatusBadgeTone, string> = {
  neutral:
    "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--brand-muted)]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning:
    "border-[var(--brand-accent)]/30 bg-[var(--brand-accent)]/10 text-[var(--brand-accent-foreground)]",
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
