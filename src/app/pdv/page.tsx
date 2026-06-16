import type { Metadata } from "next";
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
import { createSaleAction } from "@/modules/sales/presentation/create-sale-action";
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
  const eventRepository = new SupabaseEventRepository(eventClient);
  const [eventsResult, cashSessionsResult, productsResult] = await Promise.all([
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
      productRepository: new SupabaseProductRepository(productClient),
    }),
  ]);
  const eventNames = new Map(
    eventsResult.success
      ? eventsResult.events.map((event) => [event.id, event.name])
      : [],
  );

  return (
    <main className="min-h-screen bg-[#f6f7fb] px-5 py-6 text-slate-950">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            className="mb-3 inline-flex text-sm font-semibold text-[#1e3275] transition hover:text-[#142456]"
            href="/"
          >
            Voltar ao painel
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3275]">
            Vendas
          </p>
          <h1 className="mt-1 text-2xl font-semibold">PDV</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Venda rapidamente no evento ativo usando produtos, caixa aberto,
            pagamento em dinheiro e troco calculado.
          </p>
        </header>

        {!eventsResult.success ? (
          <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {eventsResult.formError}
          </section>
        ) : eventsResult.events.length === 0 ? (
          <section className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
            Nenhum evento ativo disponivel para venda.
          </section>
        ) : (
          <>
            {!cashSessionsResult.success ? (
              <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {cashSessionsResult.formError}
              </section>
            ) : (
              <PdvCashStatus
                sessions={cashSessionsResult.sessions.map((session) =>
                  toPdvCashStatusItem(session, eventNames),
                )}
              />
            )}
            <PdvEventSelector
              events={eventsResult.events.map(toPdvEventItem)}
            />
            {!productsResult.success ? (
              <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {productsResult.formError}
              </section>
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
                  .map(toPdvCartProduct)}
              />
            )}
          </>
        )}
      </section>
    </main>
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

function toPdvCartProduct(product: Product): PdvCartProduct {
  return {
    id: product.id,
    name: product.name,
    priceInReais: product.price.toReais(),
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
