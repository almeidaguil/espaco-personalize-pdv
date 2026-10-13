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
import { listProductsUseCase } from "@/modules/products/application/list-products-use-case";
import type { Product } from "@/modules/products/domain/product";
import {
  SupabaseProductRepository,
  type SupabaseProductClient,
} from "@/modules/products/infra/supabase-product-repository";
import {
  PdvCart,
  type PdvCartProduct,
} from "@/modules/sales/presentation/pdv-cart";
import { calculateStockBalance } from "@/modules/stock/domain/stock-balance";
import {
  SupabaseStockMovementRepository,
  type SupabaseStockMovementClient,
} from "@/modules/stock/infra/supabase-stock-movement-repository";
import { createSaleAction } from "@/modules/sales/presentation/create-sale-action";
import { PageHeader, PageShell } from "@/shared/components/page-shell";
import { AppNavigation } from "@/shared/components/app-navigation";
import { LoadErrorState } from "@/shared/components/status-state";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export const metadata: Metadata = {
  title: "PDV | Roberto Multimarcas ",
};

export const dynamic = "force-dynamic";

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function PdvPage() {
  const supabaseClient = await createSupabaseServerClient();
  const cashSessionClient =
    supabaseClient as unknown as SupabaseCashSessionClient;
  const currentUserProfileClient =
    supabaseClient as unknown as SupabaseCurrentUserProfileClient;
  const productClient = supabaseClient as unknown as SupabaseProductClient;
  const stockMovementClient =
    supabaseClient as unknown as SupabaseStockMovementClient;
  const productRepository = new SupabaseProductRepository(productClient);
  const stockMovementRepository = new SupabaseStockMovementRepository(
    stockMovementClient,
  );
  const cashSessionsResult = await listOpenCashSessionsUseCase({
    cashSessionRepository: new SupabaseCashSessionRepository(cashSessionClient),
    currentUserProfileRepository: new SupabaseCurrentUserProfileRepository(
      currentUserProfileClient,
    ),
  });
  const canRenderPdv =
    cashSessionsResult.success && cashSessionsResult.sessions.length > 0;
  const [productsResult, stockMovements] = canRenderPdv
    ? await Promise.all([
        listProductsUseCase({
          productRepository,
        }),
        stockMovementRepository.listAll(),
      ])
    : [null, []];
  const products = productsResult?.success ? productsResult.products : [];
  const stockMovementsByProductId = new Map<string, typeof stockMovements>();

  for (const movement of stockMovements) {
    const productMovements =
      stockMovementsByProductId.get(movement.productId) ?? [];
    productMovements.push(movement);
    stockMovementsByProductId.set(movement.productId, productMovements);
  }

  const stockQuantitiesByProductId = new Map(
    products.map((product) => [
      product.id,
      calculateStockBalance(stockMovementsByProductId.get(product.id) ?? []),
    ]),
  );

  return (
    <PageShell maxWidth="xl">
      <AppNavigation title="PDV" />

      <PageHeader
        description="Realize vendas com produtos em estoque, caixa aberto e pagamento registrado."
        eyebrow="Vendas"
        title="PDV"
      />

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
        <>
          <PdvCashStatus
            sessions={cashSessionsResult.sessions.map(toPdvCashStatusItem)}
          />

          {cashSessionsResult.sessions.length ===
          0 ? null : !productsResult?.success ? (
            <LoadErrorState
              actions={[{ href: "/pdv", label: "Tentar novamente" }]}
              eyebrow="Erro"
              message={
                productsResult?.formError ??
                "Verifique sua conexao e tente carregar os produtos novamente."
              }
              title="Nao foi possivel carregar os produtos"
            />
          ) : (
            <PdvCart
              action={createSaleAction}
              products={products
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

function toPdvCashStatusItem(session: CashSession): PdvCashStatusItem {
  return {
    id: session.id,
    openedAtLabel: dateFormatter.format(session.openedAt),
    openingAmountLabel: moneyFormatter.format(session.openingAmountInReais),
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
