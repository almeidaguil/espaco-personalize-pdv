import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/shared/types/pagination";

import { paginateItems } from "./pagination";

describe("paginateItems", () => {
  it("returns the requested page with pagination metadata", () => {
    const result = paginateItems(["a", "b", "c", "d", "e"], {
      currentPage: 2,
      pageSize: 2,
    });

    expect(result).toEqual({
      currentPage: 2,
      items: ["c", "d"],
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
    });
  });

  it("uses documented defaults when input is missing", () => {
    const items = Array.from(
      { length: DEFAULT_PAGE_SIZE + 1 },
      (_, index) => index,
    );

    const result = paginateItems(items);

    expect(result.currentPage).toBe(1);
    expect(result.items).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.totalItems).toBe(DEFAULT_PAGE_SIZE + 1);
    expect(result.totalPages).toBe(2);
  });

  it("clamps invalid pages and page sizes to safe bounds", () => {
    const items = Array.from(
      { length: MAX_PAGE_SIZE + 10 },
      (_, index) => index,
    );

    const result = paginateItems(items, {
      currentPage: 999,
      pageSize: MAX_PAGE_SIZE + 50,
    });

    expect(result.currentPage).toBe(2);
    expect(result.items).toHaveLength(10);
    expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    expect(result.totalPages).toBe(2);
  });

  it("keeps empty lists on the first page", () => {
    const result = paginateItems([], {
      currentPage: 3,
      pageSize: 5,
    });

    expect(result).toEqual({
      currentPage: 1,
      items: [],
      pageSize: 5,
      totalItems: 0,
      totalPages: 1,
    });
  });
});
