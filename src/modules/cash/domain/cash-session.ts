import {
  paymentMethods,
  type PaymentMethod,
} from "@/shared/types/payment-method";

export type CashSessionStatus = "closed" | "open";

export type CashSessionReconciliation = {
  countedAmountInCents: number;
  differenceAmountInCents: number;
  expectedAmountInCents: number;
  method: PaymentMethod;
};

export type CashSessionReconciliationInput = Pick<
  CashSessionReconciliation,
  "countedAmountInCents" | "method"
>;

export type CashSession = {
  closedAt?: Date;
  closedBy?: string;
  countedAmountInReais?: number;
  differenceAmountInReais?: number;
  expectedAmountInReais?: number;
  id: string;
  openedAt: Date;
  openingAmountInReais: number;
  operatorId: string;
  reconciliations?: CashSessionReconciliation[];
  status: CashSessionStatus;
};

export type OpenCashSessionInput = {
  id: string;
  openedAt: Date;
  openingAmountInReais: number;
  operatorId: string;
};

export type CashSessionValidationError = {
  field:
    | "id"
    | "openedAt"
    | "openingAmountInReais"
    | "operatorId"
    | "reconciliations";
  message: string;
};

export type OpenCashSessionResult =
  | {
      session: CashSession;
      success: true;
    }
  | {
      errors: CashSessionValidationError[];
      success: false;
    };

export type ValidateCashSessionReconciliationsResult =
  | {
      reconciliations: CashSessionReconciliationInput[];
      success: true;
    }
  | {
      errors: CashSessionValidationError[];
      success: false;
    };

export function openCashSession(
  input: OpenCashSessionInput,
): OpenCashSessionResult {
  const errors: CashSessionValidationError[] = [];
  const id = input.id.trim();
  const operatorId = input.operatorId.trim();

  if (!id) {
    errors.push({
      field: "id",
      message: "Cash session id is required.",
    });
  }

  if (!operatorId) {
    errors.push({
      field: "operatorId",
      message: "Cash session operator id is required.",
    });
  }

  if (!isValidDate(input.openedAt)) {
    errors.push({
      field: "openedAt",
      message: "Cash session open date must be valid.",
    });
  }

  if (!Number.isFinite(input.openingAmountInReais)) {
    errors.push({
      field: "openingAmountInReais",
      message: "Opening amount must be a valid BRL amount.",
    });
  }

  if (input.openingAmountInReais < 0) {
    errors.push({
      field: "openingAmountInReais",
      message: "Opening amount cannot be negative.",
    });
  }

  if (
    Number.isFinite(input.openingAmountInReais) &&
    !hasBrlPrecision(input.openingAmountInReais)
  ) {
    errors.push({
      field: "openingAmountInReais",
      message: "Opening amount can have at most 2 decimal places.",
    });
  }

  if (errors.length > 0) {
    return {
      errors,
      success: false,
    };
  }

  return {
    session: {
      id,
      openedAt: input.openedAt,
      openingAmountInReais: input.openingAmountInReais,
      operatorId,
      status: "open",
    },
    success: true,
  };
}

export function validateCashSessionReconciliations(
  reconciliations: CashSessionReconciliationInput[],
): ValidateCashSessionReconciliationsResult {
  const methods = reconciliations.map(
    (reconciliation) => reconciliation.method,
  );
  const hasEveryMethodExactlyOnce =
    reconciliations.length === paymentMethods.length &&
    new Set(methods).size === paymentMethods.length &&
    paymentMethods.every((method) => methods.includes(method));
  const hasValidAmounts = reconciliations.every(
    (reconciliation) =>
      Number.isSafeInteger(reconciliation.countedAmountInCents) &&
      reconciliation.countedAmountInCents >= 0,
  );

  if (!hasEveryMethodExactlyOnce || !hasValidAmounts) {
    return {
      errors: [
        {
          field: "reconciliations",
          message:
            "Cash session must reconcile every payment method exactly once with a non-negative safe integer.",
        },
      ],
      success: false,
    };
  }

  return { reconciliations, success: true };
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function hasBrlPrecision(amountInReais: number): boolean {
  const cents = amountInReais * 100;

  return Math.abs(cents - Math.round(cents)) < 1e-8;
}
