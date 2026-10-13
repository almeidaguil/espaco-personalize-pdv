import Link from "next/link";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { listOpenCashSessionOverviewsUseCase } from "@/modules/cash/application/list-open-cash-session-overviews-use-case";
import {
  SupabaseOpenCashSessionOverviewRepository,
  type SupabaseOpenCashSessionOverviewClient,
} from "@/modules/cash/infra/supabase-open-cash-session-overview-repository";
import { OpenCashSessionsPanel } from "@/modules/cash/presentation/open-cash-sessions-panel";
import { AppHeader } from "@/shared/components/app-header";
import { PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const dynamic = "force-dynamic";

const modules = [
  {
    description: "Cadastro, consulta e preparação para venda.",
    href: "/products",
    status: "Disponível",
    title: "Produtos",
  },
  {
    description: "Ajustes iniciais e manuais por movimentação.",
    href: "/stock",
    status: "Disponível",
    title: "Estoque",
  },
  {
    description: "Venda com carrinho, pagamento em dinheiro e troco.",
    href: "/pdv",
    status: "Disponível",
    title: "PDV",
  },
  {
    description: "Abertura, fechamento e turnos de operação.",
    href: "/cash/open",
    status: "Disponível",
    title: "Caixa",
  },
  {
    description: "Vendas registradas, detalhes e cancelamentos.",
    href: "/sales",
    status: "Disponível",
    title: "Vendas",
  },
  {
    description: "Vendas por período, operador e caixa.",
    href: "/reports",
    status: "Disponível",
    title: "Relatórios",
  },
] as const;

const adminModules = [
  {
    description: "Usuários, perfis de acesso e senhas temporárias.",
    href: "/settings",
    status: "Admin",
    title: "Configurações",
  },
] as const;

export default async function Home() {
  const supabaseClient = await createSupabaseServerClient();
  const currentUserProfileRepository = new SupabaseCurrentUserProfileRepository(
    supabaseClient as unknown as SupabaseCurrentUserProfileClient,
  );

  const [currentUserResult, openCashSessionsResult] = await Promise.all([
    currentUserProfileRepository.getCurrent(),
    listOpenCashSessionOverviewsUseCase({
      currentUserProfileRepository,
      openCashSessionOverviewRepository:
        new SupabaseOpenCashSessionOverviewRepository(
          supabaseClient as unknown as SupabaseOpenCashSessionOverviewClient,
        ),
    }),
  ]);

  const isAdmin =
    currentUserResult.success && currentUserResult.profile.role === "admin";
  const openCashSessions = openCashSessionsResult.success
    ? openCashSessionsResult.overviews
    : [];
  const currentCashSession = currentUserResult.success
    ? openCashSessions.find(
        (session) => session.operatorId === currentUserResult.profile.id,
      )
    : undefined;

  return (
    <PageShell maxWidth="xl">
      <AppHeader showAdminNavigation={isAdmin} title="Painel" />

      <Panel className="grid gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent-foreground)]">
              Meu caixa
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--brand-foreground)]">
              {currentCashSession ? "Caixa aberto" : "Caixa fechado"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-muted)]">
              {currentCashSession
                ? "Use o PDV para vender ou feche o caixa ao encerrar o turno."
                : "Abra o caixa antes de registrar vendas."}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {currentCashSession ? (
              <>
                <OperationalLink href="/pdv" label="Ir ao PDV" primary />
                <OperationalLink href="/cash/close" label="Fechar caixa" />
              </>
            ) : (
              <OperationalLink href="/cash/open" label="Abrir caixa" primary />
            )}
          </div>
        </div>

        {!openCashSessionsResult.success ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Alguns dados operacionais não puderam ser carregados agora.
          </p>
        ) : null}
      </Panel>

      {isAdmin ? <OpenCashSessionsPanel sessions={openCashSessions} /> : null}

      <section className="grid gap-3 sm:grid-cols-2">
        {[...modules, ...(isAdmin ? adminModules : [])].map((module) => (
          <Link
            className="group rounded-2xl border border-[var(--border)] bg-[var(--brand-surface)] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand-accent)]/70 hover:shadow-[0_14px_35px_rgba(0,0,0,0.07)]"
            href={module.href}
            key={module.title}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[var(--brand-foreground)] transition group-hover:text-[var(--brand-accent-foreground)]">
                  {module.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--brand-muted)]">
                  {module.description}
                </p>
              </div>
              <StatusBadge
                tone={module.status === "Admin" ? "warning" : "neutral"}
              >
                {module.status}
              </StatusBadge>
            </div>
            <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-[var(--brand-accent-foreground)] opacity-0 transition duration-200 group-hover:opacity-100">
              Acessar
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                →
              </span>
            </div>
          </Link>
        ))}
      </section>
    </PageShell>
  );
}

function OperationalLink({
  href,
  label,
  primary = false,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={
        primary
          ? "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-4 py-2 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105"
          : "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)]"
      }
      href={href}
    >
      {label}
    </Link>
  );
}
