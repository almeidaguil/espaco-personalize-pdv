import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "../application/cash-session-repository";
import type { CashSession } from "../domain/cash-session";
import { closeCashSessionActionService } from "./close-cash-session-action-service";

class FakeCashSessionRepository implements CashSessionRepository {
  public updatedSession?: CashSession;
  public updateOptions?: { adminPassword?: string };

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
  ) {}

  async findOpenByIdAndOperator(): Promise<FindOpenCashSessionResult> {
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

  async update(
    session: CashSession,
    options?: { adminPassword?: string },
  ): Promise<SaveCashSessionResult> {
    this.updateOptions = options;
    this.updatedSession = session;

    return {
      session,
      success: true,
    };
  }
}

describe("closeCashSessionActionService", () => {
  it("closes a cash session for the current user", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await closeCashSessionActionService(
      {},
      createFormData({
        cashSessionId: "cash-session-1",
        countedAmountInReais: "260,75",
        adminPassword: "admin-password-test",
      }),
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      successMessage: "Caixa fechado com sucesso.",
    });
    expect(cashSessionRepository.updatedSession).toMatchObject({
      closedAt: new Date("2026-07-10T18:00:00.000Z"),
      id: "cash-session-1",
      countedAmountInReais: 260.75,
      operatorId: "operator-1",
      status: "closed",
    });
    expect(cashSessionRepository.updateOptions).toEqual({
      adminPassword: "admin-password-test",
    });
  });

  it("returns validation errors from the use case", async () => {
    const result = await closeCashSessionActionService(
      {},
      createFormData({
        cashSessionId: "",
        countedAmountInReais: "",
      }),
      {
        cashSessionRepository: new FakeCashSessionRepository(),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        cashSessionId: "Informe o caixa aberto.",
        countedAmountInReais: "Informe o valor contado em Reais.",
      },
      formError: undefined,
    });
  });

  it("returns missing open session errors", async () => {
    const result = await closeCashSessionActionService(
      {},
      createFormData({
        cashSessionId: "cash-session-1",
        countedAmountInReais: "260,75",
      }),
      {
        cashSessionRepository: new FakeCashSessionRepository({
          session: null,
          success: true,
        }),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        getCurrentDate: () => new Date("2026-07-10T18:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      fieldErrors: undefined,
      formError: "Nao ha caixa aberto para fechar.",
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

function createFormData(input: {
  adminPassword?: string;
  cashSessionId: string;
  countedAmountInReais: string;
}): FormData {
  const formData = new FormData();
  if (input.adminPassword) {
    formData.set("adminPassword", input.adminPassword);
  }
  formData.set("cashSessionId", input.cashSessionId);
  formData.set("countedAmountInReais", input.countedAmountInReais);

  return formData;
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
