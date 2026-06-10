import type { AuthSession } from "../domain/auth-session";

export type SignInWithPasswordInput = {
  email: string;
  password: string;
};

export type SignInWithPasswordResult =
  | {
      session: AuthSession;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

export type AuthRepository = {
  signInWithPassword(
    input: SignInWithPasswordInput,
  ): Promise<SignInWithPasswordResult>;
};
