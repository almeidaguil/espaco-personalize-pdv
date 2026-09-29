import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PanelElement = "article" | "div" | "form" | "header" | "li" | "section";

type PanelProps<TElement extends PanelElement = "section"> = {
  as?: TElement;
  children: ReactNode;
  className?: string;
  padding?: "md" | "none" | "sm";
} & Omit<ComponentPropsWithoutRef<TElement>, "as" | "children" | "className">;

const paddingClasses = {
  md: "p-5",
  none: "",
  sm: "p-4",
} as const;

export function Panel<TElement extends PanelElement = "section">({
  as,
  children,
  className,
  padding = "md",
  ...props
}: PanelProps<TElement>) {
  const Component = (as ?? "section") as ElementType;

  const classes = [
    "rounded-2xl border border-[var(--border)] bg-[var(--brand-surface)] shadow-[0_8px_30px_rgba(0,0,0,0.04)]",
    paddingClasses[padding],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
