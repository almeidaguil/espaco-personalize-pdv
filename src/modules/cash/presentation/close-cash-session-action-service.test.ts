import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CashSessionRepository,
  CloseCashSessionPersistenceInput,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "../application/cash-session-repository";
import type { CashSession } from "../domain/cash-session";
import { closeCashSessionActionService } from "./close-cash-session-action-service";

class FakeCashSessionRepository implements CashSessionRepository {
  public closeInput?: CloseCashSessionPersistenceInput;

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: createCashSession(),
      success: true,
    },
  ) {}

  async findOpenById(): Promise<FindOpenCashSessionResult> {
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
      session: {
        ...createCashSession(),
        openingAmountInReais: input.openingAmountInReais,
      },
      success: true,
    };
  }

  async close(
    input: CloseCashSessionPersistenceInput,
  ): Promise<SaveCashSessionResult> {
    this.closeInput = input;

    return {
      session: {
        ...createCashSession(),
        closedAt: new Date("2026-07-10T18:00:00.000Z"),
        status: "closed",
      },
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
        countedAmounts: ["260,75", "100,00", "200,00", "50,00"],
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
    expect(cashSessionRepository.closeInput).toEqual({
      adminPassword: "admin-password-test",
      cashSessionId: "cash-session-1",
      reconciliations: [
        { countedAmountInCents: 26075, method: "cash" },
        { countedAmountInCents: 10000, method: "pix" },
        { countedAmountInCents: 20000, method: "credit_card" },
        { countedAmountInCents: 5000, method: "debit_card" },
      ],
    });
  });

  it("returns validation errors from the use case", async () => {
    const result = await closeCashSessionActionService(
      {},
      createFormData({
        cashSessionId: "",
        countedAmounts: ["", "", "", ""],
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
        reconciliations:
          "Informe a conferencia dos quatro metodos de pagamento.",
      },
      formError: undefined,
    });
  });

  it("returns missing open session errors", async () => {
    const result = await closeCashSessionActionService(
      {},
      createFormData({
        cashSessionId: "cash-session-1",
        countedAmounts: ["260,75", "100,00", "200,00", "50,00"],
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
  countedAmounts: [string, string, string, string];
}): FormData {
  const formData = new FormData();
  if (input.adminPassword) {
    formData.set("adminPassword", input.adminPassword);
  }
  formData.set("cashSessionId", input.cashSessionId);
  formData.set("countedAmount_cash", input.countedAmounts[0]);
  formData.set("countedAmount_pix", input.countedAmounts[1]);
  formData.set("countedAmount_credit_card", input.countedAmounts[2]);
  formData.set("countedAmount_debit_card", input.countedAmounts[3]);

  return formData;
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
