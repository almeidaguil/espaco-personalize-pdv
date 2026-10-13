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
  public findById?: string;
  public updateOptions?: { adminPassword?: string };
  public updatedSession?: CashSession;

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
    private readonly updateResult?: SaveCashSessionResult,
  ) {}

  async findOpenById(
    cashSessionId: string,
  ): Promise<FindOpenCashSessionResult> {
    this.findById = cashSessionId;

    return this.findResult;
  }

  async listOpenByOperator() {
    return {
      sessions: [],
      success: true as const,
    };
  }

  async findOpenByOperator(): Promise<FindOpenCashSessionResult> {
    return { session: null, success: true };
  }

  async open(input: {
    openingAmountInReais: number;
  }): Promise<SaveCashSessionResult> {
    return {
      session: createCashSession({
        openingAmountInReais: input.openingAmountInReais,
      }),
      success: true,
    };
  }

  async update(
    session: CashSession,
    options?: { adminPassword?: string },
  ): Promise<SaveCashSessionResult> {
    this.updateOptions = options;
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
        adminPassword: "admin-password-test",
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
    expect(cashSessionRepository.findById).toBe("cash-session-1");
    expect(cashSessionRepository.updatedSession).toEqual({
      closedAt: new Date("2026-07-10T18:00:00.000Z"),
      countedAmountInReais: 260.75,
      id: "cash-session-1",
      openedAt: new Date("2026-07-10T12:00:00.000Z"),
      openingAmountInReais: 150.5,
      operatorId: "operator-1",
      status: "closed",
    });
    expect(cashSessionRepository.updateOptions).toEqual({
      adminPassword: "admin-password-test",
    });
  });

  it("rejects an operator who tries to close another operator's open cash session", async () => {
    const cashSessionRepository = new FakeCashSessionRepository({
      session: createCashSession({ operatorId: "operator-2" }),
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
      formError: "Voce nao tem permissao para fechar este caixa.",
      success: false,
    });
    expect(cashSessionRepository.updatedSession).toBeUndefined();
  });

  it("allows an admin to close another operator's open cash session", async () => {
    const cashSessionRepository = new FakeCashSessionRepository({
      session: createCashSession({ operatorId: "operator-2" }),
      success: true,
    });

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        countedAmountInReais: 260.75,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository({
          id: "admin-1",
          role: "admin",
        }),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result.success).toBe(true);
    expect(cashSessionRepository.findById).toBe("cash-session-1");
    expect(cashSessionRepository.updatedSession).toMatchObject({
      id: "cash-session-1",
      operatorId: "operator-2",
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

  it("does not persist when the selected session is already closed", async () => {
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
    expect(cashSessionRepository.findById).toBe("cash-session-1");
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

  it("maps admin password failures to a shortage form error", async () => {
    const cashSessionRepository = new FakeCashSessionRepository(
      {
        session: createCashSession(),
        success: true,
      },
      {
        error: "admin_password_required",
        success: false,
      },
    );

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        countedAmountInReais: 200,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      formError: "Informe a senha administrativa para fechar caixa com falta.",
      success: false,
    });
  });
});

function createCurrentUserProfileRepository(
  profile: { id: string; role: "admin" | "operator" } = {
    id: "operator-1",
    role: "operator",
  },
): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({
      profile,
      success: true,
    }),
  };
}

function createCashSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: "cash-session-1",
    openedAt: new Date("2026-07-10T12:00:00.000Z"),
    openingAmountInReais: 150.5,
    operatorId: "operator-1",
    status: "open",
    ...overrides,
  };
}
