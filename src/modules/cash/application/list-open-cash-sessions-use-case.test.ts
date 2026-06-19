import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  ListOpenCashSessionsResult,
  SaveCashSessionResult,
} from "./cash-session-repository";
import { listOpenCashSessionsUseCase } from "./list-open-cash-sessions-use-case";
import type { CashSession } from "../domain/cash-session";

class FakeCashSessionRepository implements CashSessionRepository {
  public operatorId?: string;

  constructor(private readonly result: ListOpenCashSessionsResult) {}

  async findOpenByIdAndOperator(): Promise<FindOpenCashSessionResult> {
    return {
      session: null,
      success: true,
    };
  }

  async findOpenByEventAndOperator(): Promise<FindOpenCashSessionResult> {
    return {
      session: null,
      success: true,
    };
  }

  async listOpenByOperator(
    operatorId: string,
  ): Promise<ListOpenCashSessionsResult> {
    this.operatorId = operatorId;

    return this.result;
  }

  async save(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }

  async update(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }
}

describe("listOpenCashSessionsUseCase", () => {
  it("lists open cash sessions for the current user", async () => {
    const session = createCashSession();
    const cashSessionRepository = new FakeCashSessionRepository({
      sessions: [session],
      success: true,
    });

    const result = await listOpenCashSessionsUseCase({
      cashSessionRepository,
      currentUserProfileRepository: createCurrentUserProfileRepository(),
    });

    expect(cashSessionRepository.operatorId).toBe("operator-1");
    expect(result).toEqual({
      sessions: [session],
      success: true,
    });
  });

  it("maps unauthenticated users to a form error", async () => {
    const result = await listOpenCashSessionsUseCase({
      cashSessionRepository: new FakeCashSessionRepository({
        sessions: [],
        success: true,
      }),
      currentUserProfileRepository: {
        getCurrent: async () => ({
          error: "unauthenticated",
          success: false,
        }),
      },
    });

    expect(result).toEqual({
      formError: "Sessao expirada. Entre novamente.",
      success: false,
    });
  });

  it("maps repository failures to a form error", async () => {
    const result = await listOpenCashSessionsUseCase({
      cashSessionRepository: new FakeCashSessionRepository({
        error: "unknown",
        success: false,
      }),
      currentUserProfileRepository: createCurrentUserProfileRepository(),
    });

    expect(result).toEqual({
      formError: "Nao foi possivel carregar os caixas abertos.",
      success: false,
    });
  });
});

function createCurrentUserProfileRepository(): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile: {
        id: "operator-1",
        role: "operator",
      },
      success: true,
    }),
  };
}

function createCashSession(): CashSession {
  return {
    eventId: "event-1",
    id: "cash-session-1",
    openedAt: new Date("2026-07-10T12:00:00.000Z"),
    openingAmountInReais: 150.5,
    operatorId: "operator-1",
    status: "open",
  };
}
