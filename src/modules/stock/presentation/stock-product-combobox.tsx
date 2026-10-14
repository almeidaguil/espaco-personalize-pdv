"use client";

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { normalizeSearchTerm } from "@/shared/utils/search";

export type StockAdjustmentProductOption = {
  id: string;
  name: string;
  sku?: string;
};

type StockProductComboboxProps = {
  errorId?: string;
  invalid?: boolean;
  onSelectionChange?: (productId: string) => void;
  products: StockAdjustmentProductOption[];
};

export function StockProductCombobox({
  errorId,
  invalid = false,
  onSelectionChange,
  products,
}: StockProductComboboxProps) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const helpId = `${inputId}-help`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");

  const filteredProducts = useMemo(
    () => filterProducts(products, query),
    [products, query],
  );

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );

  const activeProduct = filteredProducts[activeIndex];
  const hasProducts = products.length > 0;

  useEffect(() => {
    if (!isOpen || !activeProduct) return;

    document
      .getElementById(getOptionId(listboxId, activeProduct.id))
      ?.scrollIntoView?.({ block: "nearest" });
  }, [activeProduct, isOpen, listboxId]);

  return (
    <div className="grid gap-2">
      <label
        className="text-sm font-semibold text-[var(--brand-foreground)]"
        htmlFor={inputId}
      >
        Buscar produto
      </label>

      <input name="productId" type="hidden" value={selectedProduct?.id ?? ""} />

      <div className="relative">
        <input
          aria-activedescendant={
            isOpen && activeProduct
              ? getOptionId(listboxId, activeProduct.id)
              : undefined
          }
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={errorId ?? helpId}
          aria-expanded={isOpen}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          className="h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 text-base text-[var(--brand-foreground)] outline-none transition placeholder:text-neutral-400 focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--brand-muted)] read-only:bg-[var(--surface-muted)]"
          disabled={!hasProducts}
          id={inputId}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedProductId("");
            onSelectionChange?.("");
            setActiveIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!selectedProduct) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={hasProducts ? "Nome ou SKU" : "Nenhum produto ativo"}
          readOnly={Boolean(selectedProduct)}
          ref={inputRef}
          role="combobox"
          type="search"
          value={query}
        />

        {isOpen && filteredProducts.length > 0 && !selectedProduct ? (
          <div
            aria-label="Produtos encontrados"
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-white p-1 shadow-xl"
            id={listboxId}
            role="listbox"
          >
            {filteredProducts.map((product, index) => (
              <button
                aria-selected={activeIndex === index}
                className={
                  activeIndex === index
                    ? "flex min-h-12 w-full items-center rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-left text-sm font-semibold text-white"
                    : "flex min-h-12 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-[var(--brand-foreground)] transition hover:bg-[var(--surface-muted)]"
                }
                id={getOptionId(listboxId, product.id)}
                key={product.id}
                onClick={() => selectProduct(product)}
                onPointerDown={(event) => event.preventDefault()}
                role="option"
                tabIndex={-1}
                type="button"
              >
                {formatProductLabel(product)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-[var(--brand-muted)]" id={helpId}>
        Digite o nome ou SKU e escolha um resultado.
      </p>

      {!hasProducts ? (
        <p className="text-sm text-[var(--brand-muted)]">
          Nenhum produto ativo
        </p>
      ) : isOpen && filteredProducts.length === 0 ? (
        <p
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--brand-muted)]"
          role="status"
        >
          Nenhum produto encontrado para esta busca.
        </p>
      ) : isOpen ? (
        <p
          className="text-xs font-medium text-[var(--brand-muted)]"
          role="status"
        >
          {filteredProducts.length} produto(s) encontrado(s)
        </p>
      ) : null}

      {selectedProduct ? (
        <div
          aria-label="Produto selecionado"
          className="flex flex-col gap-3 rounded-xl border border-[var(--brand-accent)]/50 bg-[var(--surface-muted)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
              Produto selecionado
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-[var(--brand-foreground)]">
              {formatProductLabel(selectedProduct)}
            </p>
          </div>

          <button
            className="min-h-11 shrink-0 rounded-xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--brand-foreground)] transition hover:border-[var(--brand-accent)] hover:text-[var(--brand-accent-foreground)]"
            onClick={clearSelection}
            type="button"
          >
            Trocar produto
          </button>
        </div>
      ) : null}
    </div>
  );

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (selectedProduct || filteredProducts.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) =>
        Math.min(currentIndex + 1, filteredProducts.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((currentIndex) =>
        currentIndex <= 0 ? filteredProducts.length - 1 : currentIndex - 1,
      );
      return;
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      if (activeProduct) selectProduct(activeProduct);
    }
  }

  function selectProduct(product: StockAdjustmentProductOption) {
    setSelectedProductId(product.id);
    setQuery(formatProductLabel(product));
    setActiveIndex(-1);
    setIsOpen(false);
    onSelectionChange?.(product.id);
  }

  function clearSelection() {
    setSelectedProductId("");
    setQuery("");
    setActiveIndex(-1);
    setIsOpen(true);
    onSelectionChange?.("");
    inputRef.current?.focus();
  }
}

function filterProducts(
  products: StockAdjustmentProductOption[],
  query: string,
): StockAdjustmentProductOption[] {
  const normalizedQuery = normalizeSearchTerm(query);

  if (!normalizedQuery) return products;

  return products.filter((product) => {
    const normalizedName = normalizeSearchTerm(product.name);
    const normalizedSku = normalizeSearchTerm(product.sku ?? "");

    return (
      normalizedName.includes(normalizedQuery) ||
      normalizedSku.includes(normalizedQuery)
    );
  });
}

function formatProductLabel(product: StockAdjustmentProductOption): string {
  return product.sku ? `${product.name} — ${product.sku}` : product.name;
}

function getOptionId(listboxId: string, productId: string): string {
  return `${listboxId}-${productId}`;
}
