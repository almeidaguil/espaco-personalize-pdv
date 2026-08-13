import type { Metadata } from "next";

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
import {
  PdvCashStatus,
  type PdvCashStatusItem,
} from "@/modules/cash/presentation/pdv-cash-status";
import { listActiveEventsUseCase } from "@/modules/events/application/list-active-events-use-case";
import type { Event } from "@/modules/events/domain/event";
import {
  SupabaseEventRepository,
  type SupabaseEventClient,
} from "@/modules/events/infra/supabase-event-repository";
import {
  PdvEventSelector,
  type PdvEventSelectorItem,
} from "@/modules/events/presentation/pdv-event-selector";
import { listProductsUseCase } from "@/modules/products/application/list-products-use-case";
import type { Product } from "@/modules/products/domain/product";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import {
  PdvCart,
  type PdvCartCashSession,
  type PdvCartProduct,
} from "@/modules/sales/presentation/pdv-cart";
import { calculateStockBalance } from "@/modules/stock/domain/stock-balance";
import {
  SupabaseStockMovementRepository,
  type SupabaseStockMovementClient,
} from "@/modules/stock/infra/supabase-stock-movement-repository";
import { createSaleAction } from "@/modules/sales/presentation/create-sale-action";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { EmptyState, LoadErrorState } from "@/shared/components/status-state";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "PDV | Espaco Personalize PDV",
};

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function PdvPage() {
  const supabaseClient = await createSupabaseServerClient();
  const eventClient = supabaseClient as unknown as SupabaseEventClient;
  const cashSessionClient =
    supabaseClient as unknown as SupabaseCashSessionClient;
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const productClient = supabaseClient as unknown as SupabaseProductClient;
  const stockMovementClient =
    supabaseClient as unknown as SupabaseStockMovementClient;
  const eventRepository = new SupabaseEventRepository(eventClient);
  const productRepository = new SupabaseProductRepository(productClient);
  const stockMovementRepository = new SupabaseStockMovementRepository(
    stockMovementClient,
  );
  const [eventsResult, cashSessionsResult, productsResult, stockMovements] =
    await Promise.all([
      listActiveEventsUseCase({ eventRepository }),
      listOpenCashSessionsUseCase({
        cashSessionRepository: new SupabaseCashSessionRepository(
          cashSessionClient,
        ),
        currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
          currentUserProfileClient,
        ),
      }),
      listProductsUseCase({
        productRepository,
      }),
      stockMovementRepository.listAll(),
    ]);
  const eventNames = new Map(
    eventsResult.success
      ? eventsResult.events.map((event) => [event.id, event.name])
      : [],
  );
  const stockMovementsByProductId = new Map<string, typeof stockMovements>();

  for (const movement of stockMovements) {
    const productMovements =
      stockMovementsByProductId.get(movement.productId) ?? [];
    productMovements.push(movement);
    stockMovementsByProductId.set(movement.productId, productMovements);
  }

  const stockQuantitiesByProductId = new Map(
    (productsResult.success ? productsResult.products : []).map((product) => [
      product.id,
      calculateStockBalance(stockMovementsByProductId.get(product.id) ?? []),
    ]),
  );

  return (
    <PageShell>
      <PageHeader
        description="Venda rapidamente no evento ativo usando produtos, caixa aberto, forma de pagamento registrada e troco calculado quando a venda for em dinheiro."
        eyebrow="Vendas"
        title="PDV"
      />

      {!eventsResult.success ? (
        <LoadErrorState
          actions={[{ href: "/pdv", label: "Tentar novamente" }]}
          eyebrow="Erro"
          message={
            eventsResult.formError ??
            "Verifique sua conexao e tente carregar o evento ativo novamente."
          }
          title="Nao foi possivel carregar o evento ativo"
        />
      ) : eventsResult.events.length === 0 ? (
        <EmptyState
          actions={[
            { href: "/events/new", label: "Criar evento" },
            { href: "/events", label: "Ver eventos", variant: "secondary" },
          ]}
          eyebrow="Sem evento ativo"
          message="Ative ou crie um evento antes de iniciar vendas no PDV."
          title="Nenhum evento ativo disponivel para venda."
        />
      ) : (
        <>
          {!cashSessionsResult.success ? (
            <LoadErrorState
              actions={[{ href: "/pdv", label: "Tentar novamente" }]}
              eyebrow="Erro"
              message={
                cashSessionsResult.formError ??
                "Verifique sua conexao e tente carregar os caixas abertos novamente."
              }
              title="Nao foi possivel carregar os caixas abertos"
            />
          ) : (
            <PdvCashStatus
              sessions={cashSessionsResult.sessions.map((session) =>
                toPdvCashStatusItem(session, eventNames),
              )}
            />
          )}
          <PdvEventSelector events={eventsResult.events.map(toPdvEventItem)} />
          {!productsResult.success ? (
            <LoadErrorState
              actions={[{ href: "/pdv", label: "Tentar novamente" }]}
              eyebrow="Erro"
              message={
                productsResult.formError ??
                "Verifique sua conexao e tente carregar os produtos novamente."
              }
              title="Nao foi possivel carregar os produtos"
            />
          ) : (
            <PdvCart
              action={createSaleAction}
              cashSessions={
                cashSessionsResult.success
                  ? cashSessionsResult.sessions.map((session) =>
                      toPdvCartCashSession(session, eventNames),
                    )
                  : []
              }
              products={productsResult.products
                .filter((product) => product.isActive)
                .map((product) =>
                  toPdvCartProduct(
                    product,
                    stockQuantitiesByProductId.get(product.id) ?? 0,
                  ),
                )}
            />
          )}
        </>
      )}
    </PageShell>
  );
}

function toPdvEventItem(event: Event): PdvEventSelectorItem {
  return {
    id: event.id,
    location: event.location ?? null,
    name: event.name,
    startsAtLabel: dateFormatter.format(event.startsAt),
  };
}

function toPdvCashStatusItem(
  session: CashSession,
  eventNames: Map<string, string>,
): PdvCashStatusItem {
  return {
    eventName: eventNames.get(session.eventId) ?? "Evento sem nome",
    id: session.id,
    openedAtLabel: dateFormatter.format(session.openedAt),
  };
}

function toPdvCartProduct(
  product: Product,
  quantityOnHand: number,
): PdvCartProduct {
  return {
    id: product.id,
    name: product.name,
    priceInReais: product.price.toReais(),
    quantityOnHand,
    ...(product.sku ? { sku: product.sku } : {}),
  };
}

function toPdvCartCashSession(
  session: CashSession,
  eventNames: Map<string, string>,
): PdvCartCashSession {
  return {
    eventId: session.eventId,
    eventName: eventNames.get(session.eventId) ?? "Evento sem nome",
    id: session.id,
  };
}
