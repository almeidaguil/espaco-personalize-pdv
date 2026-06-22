import type { ReactNode } from "react";

type InlineFeedbackProps = {
  children: ReactNode;
  className?: string;
  padding?: "md" | "sm";
  tone: "error" | "success";
};

const paddingClasses = {
  md: "p-4",
  sm: "px-3 py-2",
} as const;

const toneClasses = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
} as const;

export function InlineFeedback({
  children,
  className,
  padding = "sm",
  tone,
}: InlineFeedbackProps) {
  const classes = [
    "rounded-md border text-sm",
    paddingClasses[padding],
    toneClasses[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={classes}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
