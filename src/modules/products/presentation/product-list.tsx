export type ProductListItem = {
  id: string;
  isActive: boolean;
  name: string;
  priceLabel: string;
  sku: string | null;
};

type ProductListProps = {
  products: ProductListItem[];
};

export function ProductList({ products }: ProductListProps) {
  return (
    <ul className="grid gap-3">
      {products.map((product) => (
        <li
          className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
          key={product.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {product.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {product.sku ?? "Sem SKU"}
              </p>
            </div>
            <span
              className={
                product.isActive
                  ? "rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
                  : "rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600"
              }
            >
              {product.isActive ? "Ativo" : "Inativo"}
            </span>
          </div>

          <strong className="mt-4 block text-lg text-[#1e3275]">
            {product.priceLabel}
          </strong>
        </li>
      ))}
    </ul>
  );
}
