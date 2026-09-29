"use client";

import { normalizeSearchTerm } from "@/shared/utils/search";

import type { PdvCartProduct } from "./pdv-cart";

type ProductPickerProps = {
  cartQuantitiesByProductId: Map<string, number>;
  onAddProduct: (product: PdvCartProduct) => void;
  onPageChange: (updater: (currentPage: number) => number) => void;
  onSearchTermChange: (searchTerm: string) => void;
  page: number;
  products: PdvCartProduct[];
  searchTerm: string;
};

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

const productsPerPage = 8;

export function ProductPicker({
  cartQuantitiesByProductId,
  onAddProduct,
  onPageChange,
  onSearchTermChange,
  page,
  products,
  searchTerm,
}: ProductPickerProps) {
  const filteredProducts = filterProducts(products, searchTerm);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / productsPerPage),
  );

  const visibleProducts = filteredProducts.slice(
    (page - 1) * productsPerPage,
    page * productsPerPage,
  );

  if (products.length === 0) {
    return (
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--brand-muted)]">
        Nenhum produto ativo disponível para venda.
      </p>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-[var(--brand-foreground)]"
          htmlFor="productSearch"
        >
          Buscar produto
        </label>

        <input
          className="h-12 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15"
          id="productSearch"
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Nome ou SKU"
          type="search"
          value={searchTerm}
        />

        <p className="text-xs font-medium text-[var(--brand-muted)]">
          {filteredProducts.length} produto(s) encontrado(s)
        </p>
      </div>

      {visibleProducts.length === 0 ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--brand-muted)]">
          Nenhum produto encontrado para esta busca.
        </p>
      ) : (
        <div className="grid gap-2">
          {visibleProducts.map((product) => (
            <ProductListItem
              key={product.id}
              onAdd={() => onAddProduct(product)}
              product={product}
              quantityInCart={cartQuantitiesByProductId.get(product.id) ?? 0}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            className="min-h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[#9a7021] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page === 1}
            onClick={() =>
              onPageChange((currentPage) => Math.max(1, currentPage - 1))
            }
            type="button"
          >
            Anterior
          </button>

          <span className="text-sm font-semibold text-[var(--brand-muted)]">
            Página {page} de {totalPages}
          </span>

          <button
            className="min-h-11 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[#9a7021] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page === totalPages}
            onClick={() =>
              onPageChange((currentPage) =>
                Math.min(totalPages, currentPage + 1),
              )
            }
            type="button"
          >
            Próxima
          </button>
        </div>
      ) : null}
    </section>
  );
}

type ProductListItemProps = {
  onAdd: () => void;
  product: PdvCartProduct;
  quantityInCart: number;
};

function ProductListItem({
  onAdd,
  product,
  quantityInCart,
}: ProductListItemProps) {
  const hasStock = product.quantityOnHand > 0;

  const reachedStockLimit = quantityInCart >= product.quantityOnHand;

  return (
    <article className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 transition hover:border-[var(--brand-accent)]/50 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <h3 className="break-words text-sm font-bold text-[var(--brand-foreground)]">
          {product.name}
        </h3>

        <p className="mt-1 text-sm text-[var(--brand-muted)]">
          {product.sku ?? "Sem SKU"} •{" "}
          {moneyFormatter.format(product.priceInReais)}
        </p>

        <p
          className={
            hasStock
              ? "mt-1 text-xs font-semibold text-emerald-700"
              : "mt-1 text-xs font-semibold text-red-700"
          }
        >
          Estoque disponível: {product.quantityOnHand}
        </p>
      </div>

      <button
        className="min-h-11 rounded-xl border border-[var(--brand-accent)] bg-[var(--brand-accent)] px-4 text-sm font-bold text-[var(--brand-primary)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-neutral-200 disabled:text-neutral-500"
        disabled={!hasStock || reachedStockLimit}
        onClick={onAdd}
        type="button"
      >
        {!hasStock
          ? "Sem estoque"
          : reachedStockLimit
            ? "Limite no carrinho"
            : "Adicionar"}
      </button>
    </article>
  );
}

function filterProducts(
  products: PdvCartProduct[],
  searchTerm: string,
): PdvCartProduct[] {
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);

  if (!normalizedSearchTerm) {
    return products;
  }

  return products.filter((product) => {
    const productName = normalizeSearchTerm(product.name);
    const productSku = normalizeSearchTerm(product.sku ?? "");

    return (
      productName.includes(normalizedSearchTerm) ||
      productSku.includes(normalizedSearchTerm)
    );
  });
}
