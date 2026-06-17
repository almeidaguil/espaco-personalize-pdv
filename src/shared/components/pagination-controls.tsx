"use client";

type PaginationControlsProps = {
  currentPage: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
};

export function PaginationControls({
  currentPage,
  itemLabel,
  onPageChange,
  pageSize,
  totalItems,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      aria-label={`Paginacao de ${itemLabel}`}
      className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-slate-600">
        Mostrando {firstItem}-{lastItem} de {totalItems} {itemLabel}
      </p>
      <div className="flex gap-2">
        <button
          className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          Anterior
        </button>
        <span className="inline-flex min-h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-semibold text-slate-700">
          {currentPage}/{totalPages}
        </span>
        <button
          className="min-h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-[#1e3275] transition hover:border-[#1e3275] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          Proxima
        </button>
      </div>
    </nav>
  );
}
