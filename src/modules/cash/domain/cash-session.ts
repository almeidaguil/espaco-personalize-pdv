export type CashSessionStatus = "closed" | "open";

export type CashSession = {
  closedAt?: Date;
  eventId: string;
  id: string;
  openedAt: Date;
  openingAmountInReais: number;
  operatorId: string;
  status: CashSessionStatus;
};

export type OpenCashSessionInput = {
  eventId: string;
  id: string;
  openedAt: Date;
  openingAmountInReais: number;
  operatorId: string;
};

export type CloseCashSessionInput = {
  closedAt: Date;
  session: CashSession;
};

export type CashSessionValidationError = {
  field:
    | "closedAt"
    | "eventId"
    | "id"
    | "openedAt"
    | "openingAmountInReais"
    | "operatorId"
    | "status";
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

export type CloseCashSessionResult =
  | {
      session: CashSession;
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
  const eventId = input.eventId.trim();
  const operatorId = input.operatorId.trim();

  if (!id) {
    errors.push({
      field: "id",
      message: "Cash session id is required.",
    });
  }

  if (!eventId) {
    errors.push({
      field: "eventId",
      message: "Cash session event id is required.",
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
      eventId,
      id,
      openedAt: input.openedAt,
      openingAmountInReais: input.openingAmountInReais,
      operatorId,
      status: "open",
    },
    success: true,
  };
}

export function closeCashSession(
  input: CloseCashSessionInput,
): CloseCashSessionResult {
  const errors: CashSessionValidationError[] = [];

  if (input.session.status !== "open") {
    errors.push({
      field: "status",
      message: "Only open cash sessions can be closed.",
    });
  }

  if (!isValidDate(input.closedAt)) {
    errors.push({
      field: "closedAt",
      message: "Cash session close date must be valid.",
    });
  }

  if (
    isValidDate(input.closedAt) &&
    isValidDate(input.session.openedAt) &&
    input.closedAt <= input.session.openedAt
  ) {
    errors.push({
      field: "closedAt",
      message: "Cash session close date must be after open date.",
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
      ...input.session,
      closedAt: input.closedAt,
      status: "closed",
    },
    success: true,
  };
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function hasBrlPrecision(amountInReais: number): boolean {
  const cents = amountInReais * 100;

  return Math.abs(cents - Math.round(cents)) < 1e-8;
}
