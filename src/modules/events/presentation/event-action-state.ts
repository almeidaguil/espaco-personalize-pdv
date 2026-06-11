export type EventActionState = {
  fieldErrors?: Partial<
    Record<"endsAt" | "location" | "name" | "startsAt", string>
  >;
  formError?: string;
  successMessage?: string;
};
