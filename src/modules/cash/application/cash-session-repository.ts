import type { CashSession } from "../domain/cash-session";

export type SaveCashSessionResult =
  | {
      session: CashSession;
      success: true;
    }
  | {
      error: "open_session_already_exists" | "unknown";
      success: false;
    };

export type FindOpenCashSessionResult =
  | {
      session: CashSession | null;
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type ListOpenCashSessionsResult =
  | {
      sessions: CashSession[];
      success: true;
    }
  | {
      error: "unknown";
      success: false;
    };

export type CashSessionRepository = {
  findOpenByIdAndOperator(input: {
    cashSessionId: string;
    operatorId: string;
  }): Promise<FindOpenCashSessionResult>;
  findOpenByEventAndOperator(input: {
    eventId: string;
    operatorId: string;
  }): Promise<FindOpenCashSessionResult>;
  listOpenByOperator(operatorId: string): Promise<ListOpenCashSessionsResult>;
  save(session: CashSession): Promise<SaveCashSessionResult>;
  update(session: CashSession): Promise<SaveCashSessionResult>;
};
