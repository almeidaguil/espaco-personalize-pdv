import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type PaginatedResult,
  type PaginationInput,
} from "@/shared/types/pagination";

export function paginateItems<T>(
  items: readonly T[],
  input: PaginationInput = {},
): PaginatedResult<T> {
  const pageSize = normalizePageSize(input.pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = normalizeCurrentPage(input.currentPage, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  return {
    currentPage,
    items: items.slice(startIndex, endIndex),
    pageSize,
    totalItems,
    totalPages,
  };
}

function normalizeCurrentPage(
  currentPage: PaginationInput["currentPage"],
  totalPages: number,
) {
  if (typeof currentPage !== "number" || !Number.isFinite(currentPage)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(currentPage)), totalPages);
}

function normalizePageSize(pageSize: PaginationInput["pageSize"]) {
  if (typeof pageSize !== "number" || !Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(Math.max(1, Math.floor(pageSize)), MAX_PAGE_SIZE);
}
