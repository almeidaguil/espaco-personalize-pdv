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
  public savedSession?: CashSession;

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: null,
      success: true,
    },
    private readonly saveResult?: SaveCashSessionResult,
  ) {}

  async findOpenByEventAndOperator(): Promise<FindOpenCashSessionResult> {
    return this.findResult;
  }

  async save(session: CashSession): Promise<SaveCashSessionResult> {
    this.savedSession = session;

    return (
      this.saveResult ?? {
        session,
        success: true,
      }
    );
  }
}

describe("openCashSessionActionService", () => {
  it("opens a cash session for the current user", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionActionService(
      {},
      createFormData({
        eventId: "event-1",
        openingAmountInReais: "150,50",
      }),
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateCashSessionId: () => "cash-session-1",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      successMessage: "Caixa aberto com sucesso.",
    });
    expect(cashSessionRepository.savedSession).toMatchObject({
      eventId: "event-1",
      id: "cash-session-1",
      openingAmountInReais: 150.5,
      operatorId: "operator-1",
      status: "open",
    });
  });

  it("returns validation errors from the use case", async () => {
    const result = await openCashSessionActionService(
      {},
      createFormData({
        eventId: "",
        openingAmountInReais: "-1",
      }),
      {
        cashSessionRepository: new FakeCashSessionRepository(),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateCashSessionId: () => "cash-session-1",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      fieldErrors: {
        eventId: "Informe o evento.",
        openingAmountInReais: "O valor inicial nao pode ser negativo.",
      },
      formError: undefined,
    });
  });

  it("returns duplicated open session errors", async () => {
    const result = await openCashSessionActionService(
      {},
      createFormData({
        eventId: "event-1",
        openingAmountInReais: "150,50",
      }),
      {
        cashSessionRepository: new FakeCashSessionRepository({
          session: createCashSession(),
          success: true,
        }),
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateCashSessionId: () => "cash-session-2",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      fieldErrors: undefined,
      formError: "Ja existe um caixa aberto para este evento.",
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
  eventId: string;
  openingAmountInReais: string;
}): FormData {
  const formData = new FormData();
  formData.set("eventId", input.eventId);
  formData.set("openingAmountInReais", input.openingAmountInReais);

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
