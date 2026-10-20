import type {
  CashSession,
  CashSessionReconciliationInput,
} from "../domain/cash-session";

export type SaveCashSessionResult =
  | {
      session: CashSession;
      success: true;
    }
  | {
      error:
        | "admin_password_required"
        | "open_session_already_exists"
        | "unknown";
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

export type CloseCashSessionPersistenceInput = {
  adminPassword?: string;
  cashSessionId: string;
  reconciliations: CashSessionReconciliationInput[];
};

export type CashSessionRepository = {
  close(
    input: CloseCashSessionPersistenceInput,
  ): Promise<SaveCashSessionResult>;
  findOpenById(cashSessionId: string): Promise<FindOpenCashSessionResult>;
  findOpenByOperator(operatorId: string): Promise<FindOpenCashSessionResult>;
  listOpenByOperator(operatorId: string): Promise<ListOpenCashSessionsResult>;
  open(input: { openingAmountInReais: number }): Promise<SaveCashSessionResult>;
};
