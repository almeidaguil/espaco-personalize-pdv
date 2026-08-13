"use client";

import { useMemo, useState } from "react";

import { PaginationControls } from "@/shared/components/pagination-controls";
import { Panel } from "@/shared/components/panel";
import { EmptyState } from "@/shared/components/status-state";
import { DEFAULT_PAGE_SIZE } from "@/shared/types/pagination";
import { paginateItems } from "@/shared/utils/pagination";
import { normalizeSearchTerm } from "@/shared/utils/search";

import { ProductList, type ProductListItem } from "./product-list";

type ProductCatalogProps = {
  products: ProductListItem[];
};

export function ProductCatalog({ products }: ProductCatalogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProducts = useMemo(
    () => filterProducts(products, searchTerm),
    [products, searchTerm],
  );
  const paginatedProducts = paginateItems(filteredProducts, {
    currentPage,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const visibleProducts = paginatedProducts.items;

  return (
    <div className="grid gap-4">
      <Panel padding="sm">
        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor="product-search"
          >
            Buscar produto
          </label>
          <input
            autoComplete="off"
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-[#1e3275] focus:ring-2 focus:ring-[#1e3275]/15"
            id="product-search"
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Busque por nome ou SKU"
            type="search"
            value={searchTerm}
          />
          <p className="text-xs text-slate-500">
            {filteredProducts.length} produto(s) encontrado(s)
          </p>
        </div>
      </Panel>

      {filteredProducts.length === 0 ? (
        <EmptyState
          eyebrow="Busca sem resultado"
          message="Revise o nome ou SKU pesquisado. O produto pode estar inativo ou ainda nao cadastrado."
          title="Nenhum produto encontrado para a busca informada."
        />
      ) : (
        <section>
          <ProductList products={visibleProducts} />
          <PaginationControls
            currentPage={paginatedProducts.currentPage}
            itemLabel="produtos"
            onPageChange={setCurrentPage}
            pageSize={paginatedProducts.pageSize}
            totalItems={paginatedProducts.totalItems}
          />
        </section>
      )}
    </div>
  );
}

function filterProducts(
  products: ProductListItem[],
  searchTerm: string,
): ProductListItem[] {
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);

  if (!normalizedSearchTerm) {
    return products;
  }

  return products.filter((product) => {
    const normalizedName = normalizeSearchTerm(product.name);
    const normalizedSku = normalizeSearchTerm(product.sku ?? "");

    return (
      normalizedName.includes(normalizedSearchTerm) ||
      normalizedSku.includes(normalizedSearchTerm)
    );
  });
}
