import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type { CashSession } from "../domain/cash-session";
import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "./cash-session-repository";
import { openCashSessionUseCase } from "./open-cash-session-use-case";

class FakeCashSessionRepository implements CashSessionRepository {
  public findOperatorId?: string;
  public openInput?: { openingAmountInReais: number };

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: null,
      success: true,
    },
    private readonly openResult: SaveCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
  ) {}

  async findOpenByOperator(
    operatorId: string,
  ): Promise<FindOpenCashSessionResult> {
    this.findOperatorId = operatorId;

    return this.findResult;
  }

  async findOpenById(): Promise<FindOpenCashSessionResult> {
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

  async open(input: {
    openingAmountInReais: number;
  }): Promise<SaveCashSessionResult> {
    this.openInput = input;

    return this.openResult;
  }

  async update(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }
}

describe("openCashSessionUseCase", () => {
  it("opens a cash session for the authenticated operator", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionUseCase(
      {
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      session: createCashSession(),
      success: true,
    });
    expect(cashSessionRepository.findOperatorId).toBe("operator-1");
    expect(cashSessionRepository.openInput).toEqual({
      openingAmountInReais: 150.5,
    });
  });

  it("returns a field error when the opening amount is invalid", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionUseCase(
      {
        openingAmountInReais: -1,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        openingAmountInReais: "O valor inicial nao pode ser negativo.",
      },
      success: false,
    });
    expect(cashSessionRepository.openInput).toBeUndefined();
  });

  it("returns a field error when the opening amount is not numeric", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionUseCase(
      {
        openingAmountInReais: Number.NaN,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        openingAmountInReais: "Informe um valor inicial valido em Reais.",
      },
      success: false,
    });
    expect(cashSessionRepository.openInput).toBeUndefined();
  });

  it("blocks opening when the operator already has an open session", async () => {
    const cashSessionRepository = new FakeCashSessionRepository({
      session: createCashSession(),
      success: true,
    });

    const result = await openCashSessionUseCase(
      {
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      formError: "Ja existe um caixa aberto para este operador.",
      success: false,
    });
    expect(cashSessionRepository.openInput).toBeUndefined();
  });

  it("maps unauthenticated users to a form error", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionUseCase(
      {
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: {
          getCurrent: async () => ({
            error: "unauthenticated",
            success: false,
          }),
        },
      },
    );

    expect(result).toEqual({
      formError: "Sessao expirada. Entre novamente.",
      success: false,
    });
    expect(cashSessionRepository.findOperatorId).toBeUndefined();
    expect(cashSessionRepository.openInput).toBeUndefined();
  });

  it("maps atomic duplicated-session conflicts", async () => {
    const cashSessionRepository = new FakeCashSessionRepository(
      {
        session: null,
        success: true,
      },
      {
        error: "open_session_already_exists",
        success: false,
      },
    );

    const result = await openCashSessionUseCase(
      {
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      formError: "Ja existe um caixa aberto para este operador.",
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
    id: "cash-session-1",
    openedAt: new Date("2026-07-10T12:00:00.000Z"),
    openingAmountInReais: 150.5,
    operatorId: "operator-1",
    status: "open",
  };
}
