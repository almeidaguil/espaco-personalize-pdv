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
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
        Nenhum produto ativo disponivel para venda.
      </p>
    );
  }

  return (
    <section className="grid gap-3">
      <div className="grid gap-2">
        <label
          className="text-sm font-semibold text-slate-700"
          htmlFor="productSearch"
        >
          Buscar produto
        </label>
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
          id="productSearch"
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Nome ou SKU"
          type="search"
          value={searchTerm}
        />
        <p className="text-xs font-medium text-slate-500">
          {filteredProducts.length} produto(s) encontrado(s)
        </p>
      </div>

      {visibleProducts.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
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
            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275] disabled:border-slate-200 disabled:text-slate-400"
            disabled={page === 1}
            onClick={() =>
              onPageChange((currentPage) => Math.max(1, currentPage - 1))
            }
            type="button"
          >
            Anterior
          </button>
          <span className="text-sm font-semibold text-slate-600">
            Pagina {page} de {totalPages}
          </span>
          <button
            className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-[#1e3275] hover:text-[#1e3275] disabled:border-slate-200 disabled:text-slate-400"
            disabled={page === totalPages}
            onClick={() =>
              onPageChange((currentPage) =>
                Math.min(totalPages, currentPage + 1),
              )
            }
            type="button"
          >
            Proxima
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
    <article className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">{product.name}</h3>
        <p className="mt-1 text-sm text-slate-600">
          {product.sku ?? "Sem SKU"} -{" "}
          {moneyFormatter.format(product.priceInReais)}
        </p>
        <p className="mt-1 text-xs font-medium text-slate-500">
          Estoque disponivel: {product.quantityOnHand}
        </p>
      </div>
      <button
        className="min-h-11 rounded-md bg-[#1e3275] px-3 text-sm font-semibold text-white transition hover:bg-[#17275c] disabled:bg-slate-300 disabled:text-slate-600"
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
