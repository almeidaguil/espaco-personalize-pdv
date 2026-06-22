import type { ReactNode } from "react";

type FieldErrorProps = {
  children: ReactNode;
  id: string;
};

export function FieldError({ children, id }: FieldErrorProps) {
  return (
    <p className="text-sm text-red-700" id={id} role="alert">
      {children}
    </p>
  );
}
