import type { Metadata } from "next";

import { loginAction } from "@/modules/auth/presentation/login-action";
import { LoginForm } from "@/modules/auth/presentation/login-form";
import { BrandLogo } from "@/shared/components/brand-logo";
import { brand } from "@/shared/config/brand";

export const metadata: Metadata = {
  title: `Login | ${brand.name}`,
};

export default function LoginPage() {
  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#070707] text-white">
      {/* Glow superior */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-14rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[var(--brand-accent)]/10 blur-[120px]"
      />

      {/* Ondas decorativas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <svg
          className="absolute -left-24 -top-16 h-[52rem] w-[52rem] opacity-90"
          fill="none"
          viewBox="0 0 800 800"
        >
          <path
            d="M-80 215C110 80 215 320 440 170C590 70 690 70 850 125"
            stroke="rgba(205,163,79,0.42)"
            strokeWidth="2"
          />

          <path
            d="M-100 280C105 115 250 355 465 225C625 125 735 140 890 200"
            stroke="rgba(255,255,255,0.045)"
            strokeWidth="88"
            strokeLinecap="round"
          />

          <path
            d="M-130 430C100 245 250 530 470 360C615 250 740 265 900 330"
            stroke="rgba(255,255,255,0.035)"
            strokeWidth="115"
            strokeLinecap="round"
          />
        </svg>

        <svg
          className="absolute -bottom-56 -right-64 h-[60rem] w-[60rem] rotate-[8deg] opacity-95"
          fill="none"
          viewBox="0 0 900 900"
        >
          <path
            d="M35 690C230 520 330 760 555 565C690 450 795 430 980 500"
            stroke="rgba(205,163,79,0.5)"
            strokeWidth="2"
          />

          <path
            d="M0 615C220 445 345 700 565 520C725 390 830 395 995 445"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="100"
            strokeLinecap="round"
          />

          <path
            d="M-20 760C180 600 350 830 585 655C730 545 855 545 1010 605"
            stroke="rgba(255,255,255,0.025)"
            strokeWidth="125"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Conteúdo */}
      <section className="relative z-10 flex min-h-[100dvh] items-center justify-center px-4 py-4 sm:px-6">
        <div className="w-full max-w-[540px] origin-center [@media(min-width:768px)_and_(max-height:900px)]:scale-[0.9]">
          <div className="overflow-hidden rounded-[30px] border border-[var(--brand-accent)]/50 bg-[#0b0b0b]/95 shadow-[0_32px_120px_rgba(0,0,0,0.8)] backdrop-blur-xl">
            {/* Marca */}
            <div className="relative overflow-hidden px-6 pb-5 pt-6 text-center sm:px-10 sm:pt-7">
              <div
                aria-hidden="true"
                className="absolute inset-x-16 top-0 h-24 bg-[var(--brand-accent)]/10 blur-3xl"
              />

              <BrandLogo
                className="relative mx-auto h-auto w-56 mix-blend-screen sm:w-64"
                priority
              />

              <div className="mx-auto mt-4 h-px w-28 bg-gradient-to-r from-transparent via-[var(--brand-accent)] to-transparent" />
            </div>

            {/* Formulário */}
            <div className="border-t border-white/5 px-6 pb-6 pt-6 sm:px-9 sm:pb-7 sm:pt-7">
              <div className="mb-6 text-center">
                <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#f7f2e8] sm:text-[2rem]">
                  Acessar Sistema
                </h1>

                <p className="mx-auto mt-2 max-w-md text-sm leading-5 text-neutral-400">
                  Acesse sua conta para gerenciar vendas, estoque e operações da
                  loja.
                </p>
              </div>

              <LoginForm action={loginAction} />
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-neutral-600">
            © {new Date().getFullYear()} {brand.name}
          </p>
        </div>
      </section>
    </main>
  );
}
