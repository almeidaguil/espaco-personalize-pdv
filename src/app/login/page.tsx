import type { Metadata } from "next";

import { loginAction } from "@/modules/auth/presentation/login-action";
import { LoginForm } from "@/modules/auth/presentation/login-form";

export const metadata: Metadata = {
  title: "Login | Espaco Personalize PDV",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
              Espaco Personalize
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Acessar PDV</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Entre com seu e-mail e senha para operar vendas, eventos e caixa.
            </p>
          </div>

          <LoginForm action={loginAction} />
        </div>
      </section>
    </main>
  );
}
