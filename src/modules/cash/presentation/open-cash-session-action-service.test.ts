import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "../application/cash-session-repository";
import type { CashSession } from "../domain/cash-session";
import { openCashSessionActionService } from "./open-cash-session-action-service";

class FakeCashSessionRepository implements CashSessionRepository {
  public openInput?: { openingAmountInReais: number };

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: null,
      success: true,
    },
  ) {}

  async findOpenByOperator(): Promise<FindOpenCashSessionResult> {
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

    return {
      session: createCashSession(),
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

describe("openCashSessionActionService", () => {
  it("opens a cash session for the current user", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionActionService(
      {},
      createFormData("150,50"),
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      successMessage: "Caixa aberto com sucesso.",
    });
    expect(cashSessionRepository.openInput).toEqual({
      openingAmountInReais: 150.5,
    });
  });

  it("returns validation errors from the use case", async () => {
    const result = await openCashSessionActionService(
      {},
      createFormData("-1"),
      {
        cashSessionRepository: new FakeCashSessionRepository(),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        openingAmountInReais: "O valor inicial nao pode ser negativo.",
      },
      formError: undefined,
    });
  });

  it("returns duplicated open session errors", async () => {
    const result = await openCashSessionActionService(
      {},
      createFormData("150,50"),
      {
        cashSessionRepository: new FakeCashSessionRepository({
          session: createCashSession(),
          success: true,
        }),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
      },
    );

    expect(result).toEqual({
      fieldErrors: undefined,
      formError: "Ja existe um caixa aberto para este operador.",
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

function createFormData(openingAmountInReais: string): FormData {
  const formData = new FormData();
  formData.set("openingAmountInReais", openingAmountInReais);

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
