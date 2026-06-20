import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PanelElement = "article" | "div" | "li" | "section";

type PanelProps<TElement extends PanelElement = "section"> = {
  as?: TElement;
  children: ReactNode;
  className?: string;
  padding?: "md" | "sm";
} & Omit<ComponentPropsWithoutRef<TElement>, "as" | "children" | "className">;

const paddingClasses = {
  md: "p-5",
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
    "rounded-md border border-slate-200 bg-white shadow-sm",
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
