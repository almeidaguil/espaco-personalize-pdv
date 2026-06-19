import { describe, expect, it } from "vitest";

import type { CurrentUserProfileRepository } from "@/modules/auth/application/current-user-profile-repository";

import type {
  CashSessionRepository,
  FindOpenCashSessionResult,
  SaveCashSessionResult,
} from "./cash-session-repository";
import { openCashSessionUseCase } from "./open-cash-session-use-case";
import type { CashSession } from "../domain/cash-session";

class FakeCashSessionRepository implements CashSessionRepository {
  public findInput?: { eventId: string; operatorId: string };
  public savedSession?: CashSession;

  constructor(
    private readonly findResult: FindOpenCashSessionResult = {
      session: null,
      success: true,
    },
    private readonly saveResult?: SaveCashSessionResult,
  ) {}

  async findOpenByEventAndOperator(input: {
    eventId: string;
    operatorId: string;
  }): Promise<FindOpenCashSessionResult> {
    this.findInput = input;

    return this.findResult;
  }

  async findOpenByIdAndOperator(): Promise<FindOpenCashSessionResult> {
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
    this.savedSession = session;

    return (
      this.saveResult ?? {
        session,
        success: true,
      }
    );
  }

  async update(session: CashSession): Promise<SaveCashSessionResult> {
    return {
      session,
      success: true,
    };
  }
}

describe("openCashSessionUseCase", () => {
  it("opens a cash session for the current user", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionUseCase(
      {
        eventId: " event-1 ",
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateCashSessionId: () => "cash-session-1",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result.success).toBe(true);
    expect(cashSessionRepository.findInput).toEqual({
      eventId: "event-1",
      operatorId: "operator-1",
    });
    expect(cashSessionRepository.savedSession).toEqual({
      eventId: "event-1",
      id: "cash-session-1",
      openedAt: new Date("2026-07-10T12:00:00.000Z"),
      openingAmountInReais: 150.5,
      operatorId: "operator-1",
      status: "open",
    });
  });

  it("returns field errors when input is invalid", async () => {
    const cashSessionRepository = new FakeCashSessionRepository();

    const result = await openCashSessionUseCase(
      {
        eventId: "",
        openingAmountInReais: -1,
      },
      {
        cashSessionRepository,
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
      success: false,
    });
    expect(cashSessionRepository.savedSession).toBeUndefined();
  });

  it("blocks duplicated open cash sessions", async () => {
    const existingSession = createCashSession();
    const cashSessionRepository = new FakeCashSessionRepository({
      session: existingSession,
      success: true,
    });

    const result = await openCashSessionUseCase(
      {
        eventId: "event-1",
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateCashSessionId: () => "cash-session-2",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      formError: "Ja existe um caixa aberto para este evento.",
      success: false,
    });
    expect(cashSessionRepository.savedSession).toBeUndefined();
  });

  it("maps unauthenticated users to a form error", async () => {
    const result = await openCashSessionUseCase(
      {
        eventId: "event-1",
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository: new FakeCashSessionRepository(),
        currentUserProfileRepository: {
          getCurrent: async () => ({
            error: "unauthenticated",
            success: false,
          }),
        },
        generateCashSessionId: () => "cash-session-1",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      formError: "Sessao expirada. Entre novamente.",
      success: false,
    });
  });

  it("maps persistence duplicated session errors", async () => {
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
        eventId: "event-1",
        openingAmountInReais: 150.5,
      },
      {
        cashSessionRepository,
        currentUserProfileRepository: createCurrentUserProfileRepository(),
        generateCashSessionId: () => "cash-session-1",
        getCurrentDate: () => new Date("2026-07-10T12:00:00.000Z"),
      },
    );

    expect(result).toEqual({
      formError: "Ja existe um caixa aberto para este evento.",
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
