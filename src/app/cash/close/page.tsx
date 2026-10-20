import type { Metadata } from "next";

import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { listCashSessionClosingSummariesUseCase } from "@/modules/cash/application/list-cash-session-closing-summaries-use-case";
import { listOpenCashSessionOverviewsUseCase } from "@/modules/cash/application/list-open-cash-session-overviews-use-case";
import type { OpenCashSessionOverview } from "@/modules/cash/application/open-cash-session-overview-repository";
import {
  SupabaseCashSessionClosingSummaryRepository,
  type SupabaseCashSessionClosingSummaryClient,
} from "@/modules/cash/infra/supabase-cash-session-closing-summary-repository";
import {
  SupabaseOpenCashSessionOverviewRepository,
  type SupabaseOpenCashSessionOverviewClient,
} from "@/modules/cash/infra/supabase-open-cash-session-overview-repository";
import { closeCashSessionAction } from "@/modules/cash/presentation/close-cash-session-action";
import {
  CloseCashSessionForm,
  type CloseCashSessionOption,
} from "@/modules/cash/presentation/close-cash-session-form";
import { AppNavigation } from "@/shared/components/app-navigation";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
import { brand } from "@/shared/config/brand";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: `Fechar caixa | ${brand.name}`,
};

export const dynamic = "force-dynamic";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function CloseCashPage() {
  const supabaseClient = await createSupabaseServerClient();

  const openCashSessionOverviewClient =
    supabaseClient as unknown as SupabaseOpenCashSessionOverviewClient;

  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;

  const cashSessionClosingSummaryClient =
    supabaseClient as unknown as SupabaseCashSessionClosingSummaryClient;

  const overviewsResult = await listOpenCashSessionOverviewsUseCase({
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      currentUserProfileClient,
    ),
    openCashSessionOverviewRepository:
      new SupabaseOpenCashSessionOverviewRepository(
        openCashSessionOverviewClient,
      ),
  });

  const closingSummariesResult = overviewsResult.success
    ? await listCashSessionClosingSummariesUseCase({
        cashSessionClosingSummaryRepository:
          new SupabaseCashSessionClosingSummaryRepository(
            cashSessionClosingSummaryClient,
          ),
        cashSessionIds: overviewsResult.overviews.map(
          (overview) => overview.id,
        ),
      })
    : ({
        summaries: [],
        success: true,
      } as const);

  const closingSummaries = new Map(
    closingSummariesResult.success
      ? closingSummariesResult.summaries.map((summary) => [
          summary.cashSessionId,
          summary,
        ])
      : [],
  );

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="Fechar caixa" />

      <section className="mx-auto grid w-full max-w-4xl gap-5">
        <PageHeader
          backLinks={[
            {
              href: "/pdv",
              label: "Voltar para o PDV",
            },
          ]}
          description="Confira os valores do turno antes de encerrar o caixa."
          eyebrow="Caixa"
          title="Fechar caixa"
        />

        {!overviewsResult.success ? (
          <LoadErrorState
            actions={[
              {
                href: "/cash/close",
                label: "Tentar novamente",
              },
            ]}
            eyebrow="Erro"
            message={
              overviewsResult.formError ??
              "Verifique sua conexão e tente carregar os caixas abertos novamente."
            }
            title="Não foi possível carregar os caixas abertos"
          />
        ) : !closingSummariesResult.success ? (
          <LoadErrorState
            actions={[
              {
                href: "/cash/close",
                label: "Tentar novamente",
              },
            ]}
            eyebrow="Erro"
            message="A lista de caixas foi carregada, mas a conferência financeira não pôde ser calculada agora."
            title="Não foi possível calcular a conferência do caixa"
          />
        ) : overviewsResult.overviews.length === 0 ? (
          <EmptyState
            actions={[
              {
                href: "/cash/open",
                label: "Abrir caixa",
              },
              {
                href: "/pdv",
                label: "Ir ao PDV",
                variant: "secondary",
              },
            ]}
            eyebrow="Sem caixa aberto"
            message="Quando houver um caixa aberto, ele aparecerá aqui para conferência e fechamento."
            title="Nenhum caixa aberto disponível para fechamento."
          />
        ) : (
          <CloseCashSessionForm
            action={closeCashSessionAction}
            sessions={overviewsResult.overviews.map((overview) =>
              toCashSessionOption(overview, closingSummaries),
            )}
          />
        )}
      </section>
    </PageShell>
  );
}

function toCashSessionOption(
  overview: OpenCashSessionOverview,
  closingSummaries: Map<
    string,
    {
      canceledSalesCount: number;
      canceledSalesTotalInCents: number;
      completedSalesCount: number;
      completedSalesTotalInCents: number;
      expectedByMethodInCents: {
        cash: number;
        credit_card: number;
        debit_card: number;
        pix: number;
      };
      openingAmountInCents: number;
    }
  >,
): CloseCashSessionOption {
  const summary = closingSummaries.get(overview.id) ?? {
    canceledSalesCount: 0,
    canceledSalesTotalInCents: 0,
    completedSalesCount: 0,
    completedSalesTotalInCents: 0,
    expectedByMethodInCents: {
      cash: Math.round(overview.openingAmountInReais * 100),
      credit_card: 0,
      debit_card: 0,
      pix: 0,
    },
    openingAmountInCents: Math.round(overview.openingAmountInReais * 100),
  };

  return {
    canceledSalesCount: summary.canceledSalesCount,
    canceledSalesTotalInCents: summary.canceledSalesTotalInCents,
    completedSalesCount: summary.completedSalesCount,
    completedSalesTotalInCents: summary.completedSalesTotalInCents,
    expectedByMethodInCents: summary.expectedByMethodInCents,
    id: overview.id,
    label: `${overview.operatorName} · aberto em ${dateTimeFormatter.format(
      overview.openedAt,
    )} · sessão ${overview.id}`,
    openingAmountInCents: summary.openingAmountInCents,
  };
}
