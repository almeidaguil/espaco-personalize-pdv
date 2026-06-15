export type UserActionState = {
  fieldErrors?: Partial<{
    email: string;
    fullName: string;
    isActive: string;
    role: string;
    temporaryPassword: string;
    userId: string;
  }>;
  formError?: string;
  successMessage?: string;
};
