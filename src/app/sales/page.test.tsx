import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SalesPage from "./page";
import { saleSummaryFixture } from "@/modules/sales/testing/sale-summary-fixture";

vi.mock("@/shared/lib/supabase/server-client", () => ({
  createSupabaseServerClient: vi.fn(async () => ({})),
}));
vi.mock("@/shared/components/app-navigation", () => ({
  AppNavigation: () => null,
}));
const repository = vi.hoisted(() => ({
  listPage: vi.fn(),
  listFilterOptions: vi.fn(),
}));
vi.mock("@/modules/sales/infra/supabase-sale-summary-repository", () => ({
  SupabaseSaleSummaryRepository: class {
    listPage = repository.listPage;
    listFilterOptions = repository.listFilterOptions;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  repository.listPage.mockResolvedValue({
    success: true,
    sales: [saleSummaryFixture()],
    page: 1,
    pageSize: 8,
    totalCount: 1,
  });
  repository.listFilterOptions.mockResolvedValue({
    success: true,
    options: {
      operators: [{ id: "a1111111-1111-4111-8111-111111111111", name: "Ana" }],
      sessions: [],
    },
  });
});

describe("SalesPage", () => {
  it("renders operational filters and passes them to the server repository", async () => {
    render(
      await SalesPage({
        searchParams: Promise.resolve({
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          operatorId: "a1111111-1111-4111-8111-111111111111",
          status: "completed",
          page: "2",
        }),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Vendas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
    expect(screen.getByLabelText("Data operacional inicial")).toHaveValue(
      "2026-07-01",
    );
    expect(
      screen.getByRole("button", { name: "Filtrar" }).closest("form"),
    ).toHaveAttribute("method", "get");
    expect(repository.listPage).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorId: "a1111111-1111-4111-8111-111111111111",
        status: "completed",
        page: 2,
      }),
    );
  });
  it("keeps filters visible for empty results", async () => {
    repository.listPage.mockResolvedValueOnce({
      success: true,
      sales: [],
      page: 1,
      pageSize: 8,
      totalCount: 0,
    });
    render(await SalesPage());
    expect(screen.getByLabelText("Operador")).toBeInTheDocument();
    expect(screen.getByLabelText("Sessão de caixa")).toBeInTheDocument();
    expect(
      screen.getByText("Nenhuma venda encontrada para estes filtros."),
    ).toBeInTheDocument();
  });
  it("rejects malformed filters without loading sales", async () => {
    render(
      await SalesPage({
        searchParams: Promise.resolve({ operatorId: "invalid" }),
      }),
    );
    expect(
      screen.getByText("Selecione um operador válido."),
    ).toBeInTheDocument();
    expect(repository.listPage).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/sales");
  });
  it("renders load errors", async () => {
    repository.listPage.mockResolvedValueOnce({
      success: false,
      error: "unknown",
    });
    render(await SalesPage());
    expect(
      screen.getByText("Não foi possível carregar as vendas"),
    ).toBeInTheDocument();
  });
});
