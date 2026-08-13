import Link from "next/link";

import { Panel } from "@/shared/components/panel";
import { StatusBadge } from "@/shared/components/status-badge";

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
        <Panel as="li" key={product.id} padding="sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                {product.name}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {product.sku ?? "Sem SKU"}
              </p>
            </div>
            <StatusBadge tone={product.isActive ? "success" : "neutral"}>
              {product.isActive ? "Ativo" : "Inativo"}
            </StatusBadge>
          </div>

          <strong className="mt-4 block text-lg text-[#1e3275]">
            {product.priceLabel}
          </strong>

          <div className="mt-4 flex justify-end">
            <Link
              className="inline-flex h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275] hover:bg-[#1e3275]/5"
              href={`/products/${product.id}/edit`}
            >
              Editar
            </Link>
          </div>
        </Panel>
      ))}
    </ul>
  );
}
