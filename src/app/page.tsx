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
    description: "Cadastro, consulta e preparacao para venda.",
    href: "/products",
    status: "Disponivel",
    title: "Produtos",
  },
  {
    description: "Ajustes iniciais e manuais por movimentacao.",
    href: "/stock",
    status: "Disponivel",
    title: "Estoque",
  },
  {
    description: "Preparacao das vendas presenciais.",
    href: "/events",
    status: "Disponivel",
    title: "Eventos",
  },
  {
    description: "Venda com carrinho, pagamento em dinheiro e troco.",
    href: "/pdv",
    status: "Disponivel",
    title: "PDV",
  },
  {
    description: "Abertura, fechamento e turnos de evento.",
    href: "/cash/open",
    status: "Disponivel",
    title: "Caixa",
  },
  {
    description: "Vendas registradas, detalhes e cancelamentos.",
    href: "/sales",
    status: "Disponivel",
    title: "Vendas",
  },
  {
    description: "Vendas por evento, rankings e exportacao CSV.",
    href: "/reports",
    status: "Disponivel",
    title: "Relatorios",
  },
] as const;

const adminModules = [
  {
    description: "Usuarios, perfis de acesso e senhas temporarias.",
    href: "/settings",
    status: "Admin",
    title: "Configuracoes",
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
    <main className="min-h-screen bg-[#f6f7fb] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-5 py-6 sm:px-8 lg:px-10">
        <AppHeader showAdminNavigation={isAdmin} title="PDV" />

        <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
                Operacao do dia
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {getOperationalTitle({
                  currentCashSession,
                  currentEvent,
                  hasActiveEvents: activeEvents.length > 0,
                })}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {getOperationalDescription({
                  currentCashSession,
                  currentEvent,
                  hasActiveEvents: activeEvents.length > 0,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {getOperationalActions({
                currentCashSession,
                currentEvent,
                hasActiveEvents: activeEvents.length > 0,
              }).map((action) => (
                <Link
                  className={
                    action.variant === "primary"
                      ? "rounded-md bg-[#1e3275] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#17275c]"
                      : "rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275]"
                  }
                  href={action.href}
                  key={action.href}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard
              label="Evento ativo"
              value={currentEvent?.name ?? "Nao definido"}
            />
            <SummaryCard
              label="Caixa"
              value={
                currentCashSession
                  ? `Aberto desde ${dateFormatter.format(currentCashSession.openedAt)}`
                  : "Fechado"
              }
            />
            <SummaryCard
              label="Vendas do caixa"
              value={moneyFormatter.format(cashTotalInReais)}
            />
            <SummaryCard
              label="Movimentos"
              value={`${completedCashSales.length} concluidas / ${canceledCashSales.length} canceladas`}
            />
          </div>

          {!eventsResult.success ||
          !cashSessionsResult.success ||
          !salesResult.success ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Alguns dados operacionais nao puderam ser carregados agora.
            </p>
          ) : null}

          {currentCashSession ? (
            <p className="text-sm text-slate-600">
              Caixa vinculado a{" "}
              <strong className="text-slate-950">
                {eventNamesById.get(currentCashSession.eventId) ??
                  currentEvent?.name ??
                  "evento sem nome"}
              </strong>
              .
            </p>
          ) : null}
        </section>

        <section className="grid flex-1 gap-3 sm:grid-cols-2">
          {[...modules, ...(isAdmin ? adminModules : [])].map((module) => (
            <Link
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[#1e3275] hover:shadow-md"
              href={module.href}
              key={module.title}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#1e3275]">
                  {module.title}
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {module.status}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {module.description}
              </p>
            </Link>
          ))}
        </section>
      </section>
    </main>
  );
}

type SummaryCardProps = {
  label: string;
  value: string;
};

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <strong className="mt-2 block text-base text-slate-950">{value}</strong>
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
    return "Crie um evento para comecar";
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
    return "Nenhum evento ativo foi encontrado. Cadastre ou ative um evento para iniciar a operacao.";
  }

  if (!currentCashSession) {
    return currentEvent
      ? `Evento ${currentEvent.name} disponivel, mas ainda sem caixa aberto.`
      : "Ha evento ativo, mas nenhum caixa aberto para o operador atual.";
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
