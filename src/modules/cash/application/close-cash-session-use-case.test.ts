import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "./cash-session-repository";
import { closeCashSessionUseCase } from "./close-cash-session-use-case";
import type { CashSession } from "../domain/cash-session";

class FakeCashSessionRepository implements CashSessionRepository {
  public findByIdInput?: { cashSessionId: string; operatorId: string };
  public updatedSession?: CashSession;

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
    private readonly updateResult?: SaveCashSessionResult,
  ) {}

  async findOpenByIdAndOperator(input: {
    cashSessionId: string;
    operatorId: string;
  }): Promise<FindOpenCashSessionResult> {
    this.findByIdInput = input;

    return this.findResult;
  }

  async findOpenByEventAndOperator(): Promise<FindOpenCashSessionResult> {
    return {
      session: null,
      success: true,
    };
  }

  async listOpenByOperator() {
    return {
      sessions: [],
      success: true as const,
    };
  }

  async save(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }

  async update(session: CashSession): Promise<SaveCashSessionResult> {
    this.updatedSession = session;

    return (
      this.updateResult ?? {
        session,
        success: true,
      }
    );
  }
}

describe("closeCashSessionUseCase", () => {
  it("closes an open cash session for the current operator", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: " cash-session-1 ",
        countedAmountInReais: 260.75,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result.success).toBe(true);
    expect(cashSessionRepository.findByIdInput).toEqual({
      cashSessionId: "cash-session-1",
      operatorId: "operator-1",
    });
    expect(cashSessionRepository.updatedSession).toEqual({
      closedAt: new Date("2026-07-10T18:00:00.000Z"),
      countedAmountInReais: 260.75,
      eventId: "event-1",
      id: "cash-session-1",
      openedAt: new Date("2026-07-10T12:00:00.000Z"),
      openingAmountInReais: 150.5,
      operatorId: "operator-1",
      status: "closed",
    });
  });

  it("returns field errors when input is invalid", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "",
        countedAmountInReais: Number.NaN,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        cashSessionId: "Informe o caixa aberto.",
        countedAmountInReais: "Informe o valor contado em Reais.",
      },
      success: false,
    });
    expect(cashSessionRepository.updatedSession).toBeUndefined();
  });

  it("maps unauthenticated users to a form error", async () => {
    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        countedAmountInReais: 260.75,
      },
      {
        cashSessionRepository: new FakeCashSessionRepository(),
        currentUserProfileRepository: {
          getCurrent: async () => ({
            error: "unauthenticated",
            success: false,
          }),
        },
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      formError: "Sessao expirada. Entre novamente.",
      success: false,
    });
  });

  it("returns a form error when there is no open cash session", async () => {
    const cashSessionRepository = new FakeCashSessionRepository({
      session: null,
      success: true,
    });

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        countedAmountInReais: 260.75,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      formError: "Nao ha caixa aberto para fechar.",
      success: false,
    });
    expect(cashSessionRepository.updatedSession).toBeUndefined();
  });

  it("maps update failures to a form error", async () => {
    const cashSessionRepository = new FakeCashSessionRepository(
      {
        session: createCashSession(),
        success: true,
      },
      {
        error: "unknown",
        success: false,
      },
    );

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        countedAmountInReais: 260.75,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      formError: "Nao foi possivel fechar o caixa.",
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
