export const DEFAULT_PAGE_SIZE = 8;
export const MAX_PAGE_SIZE = 100;

export type PaginationInput = {
  currentPage?: number;
  pageSize?: number;
};

export type PaginatedResult<T> = {
  currentPage: number;
  items: T[];
  pageSize: number;
  totalItems: number;
  totalPages: number;
};
