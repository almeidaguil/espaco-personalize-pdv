export type LoginActionState = {
  fieldErrors?: Partial<Record<"email" | "password", string>>;
  formError?: string;
};
