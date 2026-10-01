import Link from "next/link";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { listOpenCashSessionsUseCase } from "@/modules/cash/application/list-open-cash-sessions-use-case";
import type { CashSession } from "@/modules/cash/domain/cash-session";
import {
  SupabaseCashSessionRepository,
  type SupabaseCashSessionClient,
} from "@/modules/cash/infra/supabase-cash-session-repository";
import { listActiveEventsUseCase } from "@/modules/events/application/list-active-events-use-case";
import type { Event } from "@/modules/events/domain/event";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import { listSalesUseCase } from "@/modules/sales/application/list-sales-use-case";
import {
  SupabaseSaleSummaryRepository,
  type SupabaseSaleSummaryClient,
} from "@/modules/sales/infra/supabase-sale-summary-repository";

import { AppHeader } from "@/shared/components/app-header";
import { PageShell } from "@/shared/components/page-shell";
import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const dynamic = "force-dynamic";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

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
    description: "Preparação das vendas presenciais.",
    href: "/events",
    status: "Disponível",
    title: "Eventos",
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
    description: "Vendas por evento, rankings e exportação CSV.",
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

  const [currentUserResult, eventsResult, cashSessionsResult, salesResult] =
    await Promise.all([
      currentUserProfileRepository.getCurrent(),

      listActiveEventsUseCase({
        eventRepository: new SupabaseEventRepository(
          supabaseClient as unknown as SupabaseEventClient,
        ),
      }),

      listOpenCashSessionsUseCase({
        cashSessionRepository: new SupabaseCashSessionRepository(
          supabaseClient as unknown as SupabaseCashSessionClient,
        ),
        currentUserProfileRepository,
      }),

      listSalesUseCase({
        saleSummaryRepository: new SupabaseSaleSummaryRepository(
          supabaseClient as unknown as SupabaseSaleSummaryClient,
        ),
      }),
    ]);

  const isAdmin =
    currentUserResult.success && currentUserResult.profile.role === "admin";

  const activeEvents = eventsResult.success ? eventsResult.events : [];

  const openCashSessions = cashSessionsResult.success
    ? cashSessionsResult.sessions
    : [];

  const sales = salesResult.success ? salesResult.sales : [];

  const eventNamesById = new Map(
    activeEvents.map((event) => [event.id, event.name]),
  );

  const currentCashSession = openCashSessions[0];

  const currentEvent =
    (currentCashSession
      ? activeEvents.find((event) => event.id === currentCashSession.eventId)
      : activeEvents[0]) ?? null;

  const currentCashSales = currentCashSession
    ? sales.filter((sale) => sale.cashSessionId === currentCashSession.id)
    : [];

  const completedCashSales = currentCashSales.filter(
    (sale) => sale.status === "completed",
  );

  const canceledCashSales = currentCashSales.filter(
    (sale) => sale.status === "canceled",
  );

  const cashTotalInReais = completedCashSales.reduce(
    (total, sale) => total + sale.totalInReais,
    0,
  );

  return (
    <PageShell maxWidth="xl">
      <AppHeader showAdminNavigation={isAdmin} title="Painel" />

      {/* Operação do dia */}
      <Panel className="grid gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand-accent-foreground)]">
              Operação do dia
            </p>

            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--brand-foreground)]">
              {getOperationalTitle({
                currentCashSession,
                currentEvent,
                hasActiveEvents: activeEvents.length > 0,
              })}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-muted)]">
              {getOperationalDescription({
                currentCashSession,
                currentEvent,
                hasActiveEvents: activeEvents.length > 0,
              })}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {getOperationalActions({
              currentCashSession,
              currentEvent,
              hasActiveEvents: activeEvents.length > 0,
            }).map((action) => (
              <Link
                className={
                  action.variant === "primary"
                    ? "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-4 py-2 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105"
                    : "inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)]"
                }
                href={action.href}
                key={action.href}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Resumo */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Evento ativo"
            value={currentEvent?.name ?? "Não definido"}
          />

          <SummaryCard
            label="Caixa"
            value={
              currentCashSession
                ? `Aberto desde ${dateFormatter.format(
                    currentCashSession.openedAt,
                  )}`
                : "Fechado"
            }
          />

          <SummaryCard
            label="Vendas do caixa"
            value={moneyFormatter.format(cashTotalInReais)}
          />

          <SummaryCard
            label="Movimentos"
            value={`${completedCashSales.length} concluídas / ${canceledCashSales.length} canceladas`}
          />
        </div>

        {!eventsResult.success ||
        !cashSessionsResult.success ||
        !salesResult.success ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Alguns dados operacionais não puderam ser carregados agora.
          </p>
        ) : null}

        {currentCashSession ? (
          <p className="text-sm text-[var(--brand-muted)]">
            Caixa vinculado a{" "}
            <strong className="font-semibold text-[var(--brand-foreground)]">
              {eventNamesById.get(currentCashSession.eventId) ??
                currentEvent?.name ??
                "evento sem nome"}
            </strong>
            .
          </p>
        ) : null}
      </Panel>

      {/* Módulos */}
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

type SummaryCardProps = {
  label: string;
  value: string;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="text-sm font-medium text-[var(--brand-muted)]">{label}</p>

      <strong className="mt-2 block text-base font-bold leading-6 text-[var(--brand-foreground)]">
        {value}
      </strong>
    </article>
  );
}

type OperationalState = {
  currentCashSession?: CashSession;
  currentEvent: Event | null;
  hasActiveEvents: boolean;
};

function getOperationalTitle({
  currentCashSession,
  currentEvent,
  hasActiveEvents,
}: OperationalState): string {
  if (!hasActiveEvents) {
    return "Crie um evento para começar";
  }

  if (!currentCashSession) {
    return "Abra o caixa antes de vender";
  }

  return `Pronto para vender${currentEvent ? ` em ${currentEvent.name}` : ""}`;
}

function getOperationalDescription({
  currentCashSession,
  currentEvent,
  hasActiveEvents,
}: OperationalState): string {
  if (!hasActiveEvents) {
    return "Nenhum evento ativo foi encontrado. Cadastre ou ative um evento para iniciar a operação.";
  }

  if (!currentCashSession) {
    return currentEvent
      ? `Evento ${currentEvent.name} disponível, mas ainda sem caixa aberto.`
      : "Há evento ativo, mas nenhum caixa aberto para o operador atual.";
  }

  return "Use o PDV para vender ou feche o caixa ao encerrar o turno.";
}

function getOperationalActions({
  currentCashSession,
  currentEvent,
  hasActiveEvents,
}: OperationalState): Array<{
  href: string;
  label: string;
  variant: "primary" | "secondary";
}> {
  if (!hasActiveEvents) {
    return [
      {
        href: "/events/new",
        label: "Criar evento",
        variant: "primary",
      },
    ];
  }

  if (!currentCashSession) {
    return [
      {
        href: "/cash/open",
        label: "Abrir caixa",
        variant: "primary",
      },
      {
        href: "/events",
        label: currentEvent ? "Ver eventos" : "Escolher evento",
        variant: "secondary",
      },
    ];
  }

  return [
    {
      href: "/pdv",
      label: "Ir ao PDV",
      variant: "primary",
    },
    {
      href: "/cash/close",
      label: "Fechar caixa",
      variant: "secondary",
    },
  ];
}
