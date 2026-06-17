import { describe, expect, it, vi } from "vitest";

import SaleAliasPage from "./page";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("SaleAliasPage", () => {
  it("redirects the singular sale route to sales", () => {
    SaleAliasPage();

    expect(redirectMock).toHaveBeenCalledWith("/sales");
  });
});
