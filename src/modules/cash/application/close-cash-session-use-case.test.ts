import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CashSessionRepository,
  CloseCashSessionPersistenceInput,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "./cash-session-repository";
import { closeCashSessionUseCase } from "./close-cash-session-use-case";
import type { CashSession } from "../domain/cash-session";

class FakeCashSessionRepository implements CashSessionRepository {
  public closeInput?: CloseCashSessionPersistenceInput;
  public findById?: string;

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
    private readonly closeResult?: SaveCashSessionResult,
  ) {}

  async close(
    input: CloseCashSessionPersistenceInput,
  ): Promise<SaveCashSessionResult> {
    this.closeInput = input;

    return (
      this.closeResult ?? {
        session: createClosedCashSession(),
        success: true,
      }
    );
  }

  async findOpenById(
    cashSessionId: string,
  ): Promise<FindOpenCashSessionResult> {
    this.findById = cashSessionId;
    return this.findResult;
  }

  async listOpenByOperator() {
    return { sessions: [], success: true as const };
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
}

describe("closeCashSessionUseCase", () => {
  it("closes the current operator session with every reconciliation", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();
    const reconciliations = countedReconciliations();

    const result = await closeCashSessionUseCase(
      {
        adminPassword: "admin-password-test",
        cashSessionId: " cash-session-1 ",
        reconciliations,
      },
      dependencies(cashSessionRepository),
    );

    expect(result).toEqual({
      session: createClosedCashSession(),
      success: true,
    });
    expect(cashSessionRepository.findById).toBe("cash-session-1");
    expect(cashSessionRepository.closeInput).toEqual({
      adminPassword: "admin-password-test",
      cashSessionId: "cash-session-1",
      reconciliations,
    });
  });

  it("rejects an operator closing another operator session", async () => {
    const cashSessionRepository = new FakeCashSessionRepository({
      session: createCashSession({ operatorId: "operator-2" }),
      success: true,
    });

    await expect(
      closeCashSessionUseCase(
        {
          cashSessionId: "cash-session-1",
          reconciliations: countedReconciliations(),
        },
        dependencies(cashSessionRepository),
      ),
    ).resolves.toEqual({
      formError: "Voce nao tem permissao para fechar este caixa.",
      success: false,
    });
    expect(cashSessionRepository.closeInput).toBeUndefined();
  });

  it("allows an admin to close another operator session", async () => {
    const cashSessionRepository = new FakeCashSessionRepository({
      session: createCashSession({ operatorId: "operator-2" }),
      success: true,
    });

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        reconciliations: countedReconciliations(),
      },
      dependencies(
        cashSessionRepository,
        createCurrentUserProfileRepository({ id: "admin-1", role: "admin" }),
      ),
    );

    expect(result.success).toBe(true);
    expect(cashSessionRepository.closeInput).toMatchObject({
      cashSessionId: "cash-session-1",
      reconciliations: countedReconciliations(),
    });
  });

  it.each([
    {
      name: "a missing method",
      reconciliations: countedReconciliations().slice(0, 3),
    },
    {
      name: "a duplicated method",
      reconciliations: [
        ...countedReconciliations().slice(0, 3),
        { countedAmountInCents: 0, method: "credit_card" as const },
      ],
    },
    {
      name: "a negative amount",
      reconciliations: countedReconciliations({ cash: -1 }),
    },
    {
      name: "an unsafe integer",
      reconciliations: countedReconciliations({
        cash: Number.MAX_SAFE_INTEGER + 1,
      }),
    },
  ])("rejects $name before persistence", async ({ reconciliations }) => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await closeCashSessionUseCase(
      { cashSessionId: "cash-session-1", reconciliations },
      dependencies(cashSessionRepository),
    );

    expect(result).toEqual({
      fieldErrors: {
        cashSessionId: undefined,
        reconciliations:
          "Informe a conferencia dos quatro metodos de pagamento.",
      },
      success: false,
    });
    expect(cashSessionRepository.closeInput).toBeUndefined();
  });

  it("maps unauthenticated users to a form error", async () => {
    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        reconciliations: countedReconciliations(),
      },
      dependencies(new FakeCashSessionRepository(), {
        getCurrent: async () => ({
          error: "unauthenticated",
          success: false,
        }),
      }),
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
        reconciliations: countedReconciliations(),
      },
      dependencies(cashSessionRepository),
    );

    expect(result).toEqual({
      formError: "Nao ha caixa aberto para fechar.",
      success: false,
    });
    expect(cashSessionRepository.closeInput).toBeUndefined();
  });

  it("uses a neutral administrative authorization error for any difference", async () => {
    const cashSessionRepository = new FakeCashSessionRepository(
      { session: createCashSession(), success: true },
      { error: "admin_password_required", success: false },
    );

    const result = await closeCashSessionUseCase(
      {
        cashSessionId: "cash-session-1",
        reconciliations: countedReconciliations({ pix: 999 }),
      },
      dependencies(cashSessionRepository),
    );

    expect(result).toEqual({
      formError:
        "Informe uma senha administrativa valida para fechar caixa com divergencia.",
      success: false,
    });
  });

  it("maps transactional failures without claiming the session closed", async () => {
    const cashSessionRepository = new FakeCashSessionRepository(
      { session: createCashSession(), success: true },
      { error: "unknown", success: false },
    );

    await expect(
      closeCashSessionUseCase(
        {
          cashSessionId: "cash-session-1",
          reconciliations: countedReconciliations(),
        },
        dependencies(cashSessionRepository),
      ),
    ).resolves.toEqual({
      formError: "Nao foi possivel fechar o caixa.",
      success: false,
    });
  });
});

function dependencies(
  cashSessionRepository: CashSessionRepository,
  currentUserProfileRepository = createCurrentUserProfileRepository(),
) {
  return {
    cashSessionRepository,
    currentUserProfileRepository,
    getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
  };
}

function createCurrentUserProfileRepository(
  profile: { id: string; role: "admin" | "operator" } = {
    id: "operator-1",
    role: "operator",
  },
): CurrentUserProfileRepository {
  return {
    getCurrent: async () => ({ profile, success: true }),
  };
}

function countedReconciliations(
  overrides: Partial<
    Record<"cash" | "credit_card" | "debit_card" | "pix", number>
  > = {},
) {
  return [
    { countedAmountInCents: overrides.cash ?? 15050, method: "cash" as const },
    { countedAmountInCents: overrides.pix ?? 1000, method: "pix" as const },
    {
      countedAmountInCents: overrides.credit_card ?? 2000,
      method: "credit_card" as const,
    },
    {
      countedAmountInCents: overrides.debit_card ?? 3000,
      method: "debit_card" as const,
    },
  ];
}

function createClosedCashSession(): CashSession {
  return createCashSession({
    closedAt: new Date("2026-07-10T18:00:00.000Z"),
    closedBy: "operator-1",
    countedAmountInReais: 150.5,
    differenceAmountInReais: 0,
    expectedAmountInReais: 150.5,
    reconciliations: [
      {
        countedAmountInCents: 15050,
        differenceAmountInCents: 0,
        expectedAmountInCents: 15050,
        method: "cash",
      },
      {
        countedAmountInCents: 1000,
        differenceAmountInCents: 0,
        expectedAmountInCents: 1000,
        method: "pix",
      },
      {
        countedAmountInCents: 2000,
        differenceAmountInCents: 0,
        expectedAmountInCents: 2000,
        method: "credit_card",
      },
      {
        countedAmountInCents: 3000,
        differenceAmountInCents: 0,
        expectedAmountInCents: 3000,
        method: "debit_card",
      },
    ],
    status: "closed",
  });
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
