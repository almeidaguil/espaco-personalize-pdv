import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import { listOpenCashSessionOverviewsUseCase } from "./list-open-cash-session-overviews-use-case";
import type {
  OpenCashSessionOverview,
  OpenCashSessionOverviewRepository,
} from "./open-cash-session-overview-repository";

class FakeOpenCashSessionOverviewRepository implements OpenCashSessionOverviewRepository {
  public listWasCalled = false;

  constructor(private readonly overviews: OpenCashSessionOverview[]) {}

  async listOpen() {
    this.listWasCalled = true;

    return { overviews: this.overviews, success: true } as const;
  }
}

describe("listOpenCashSessionOverviewsUseCase", () => {
  it("returns only the current operator open cash session", async () => {
    const repository = new FakeOpenCashSessionOverviewRepository([
      createOverview({ operatorId: "operator-1" }),
      createOverview({ id: "cash-session-2", operatorId: "operator-2" }),
    ]);

    const result = await listOpenCashSessionOverviewsUseCase({
      currentUserProfileRepository:
        createCurrentUserProfileRepository("operator"),
      openCashSessionOverviewRepository: repository,
    });

    expect(result).toEqual({
      overviews: [createOverview({ operatorId: "operator-1" })],
      success: true,
    });
  });

  it("returns all RLS-visible open cash sessions for an admin", async () => {
    const overviews = [
      createOverview({ operatorId: "operator-1" }),
      createOverview({ id: "cash-session-2", operatorId: "operator-2" }),
    ];

    const result = await listOpenCashSessionOverviewsUseCase({
      currentUserProfileRepository: createCurrentUserProfileRepository("admin"),
      openCashSessionOverviewRepository:
        new FakeOpenCashSessionOverviewRepository(overviews),
    });

    expect(result).toEqual({ overviews, success: true });
  });

  it("does not query open cash sessions for an unauthenticated user", async () => {
    const repository = new FakeOpenCashSessionOverviewRepository([]);

    const result = await listOpenCashSessionOverviewsUseCase({
      currentUserProfileRepository: {
        getCurrent: async () => ({ error: "unauthenticated", success: false }),
      },
      openCashSessionOverviewRepository: repository,
    });

    expect(repository.listWasCalled).toBe(false);
    expect(result).toEqual({
      formError: "Sessao expirada. Entre novamente.",
      success: false,
    });
  });
});

function createCurrentUserProfileRepository(
  role: "admin" | "operator",
): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: { id: "operator-1", role },
      success: true,
    }),
  };
}

function createOverview(
  overrides: Partial<OpenCashSessionOverview> = {},
): OpenCashSessionOverview {
  return {
    id: "cash-session-1",
    openedAt: new Date("2026-10-03T09:00:00.000Z"),
    openingAmountInReais: 100,
    operatorId: "operator-1",
    operatorName: "Ana Souza",
    ...overrides,
  };
}
