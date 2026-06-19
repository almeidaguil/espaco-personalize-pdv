export const paymentMethods = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
] as const;

export type PaymentMethod = (typeof paymentMethods)[number];
export type SaleStatus = "completed" | "canceled";

export type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  totalInReais: number;
  unitPriceInReais: number;
};

export type Payment = {
  amountInReais: number;
  changeInReais: number;
  method: PaymentMethod;
};

export type Sale = {
  cashSessionId: string;
  completedAt: Date;
  eventId: string;
  id: string;
  items: SaleItem[];
  payment: Payment;
  status: SaleStatus;
  totalInReais: number;
};

export type CreateSaleItemInput = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceInReais: number;
};

export type CreatePaymentInput = {
  amountInReais: number;
  method: PaymentMethod;
};

export type CreateSaleInput = {
  cashSessionId: string;
  completedAt: Date;
  eventId: string;
  id: string;
  items: CreateSaleItemInput[];
  payment: CreatePaymentInput;
};

export type SaleValidationError = {
  field:
    | "cashSessionId"
    | "completedAt"
    | "eventId"
    | "id"
    | "items"
    | "payment";
  message: string;
};

export type CreateSaleResult =
  | {
      sale: Sale;
      success: true;
    }
  | {
      errors: SaleValidationError[];
      success: false;
    };

export function createSale(input: CreateSaleInput): CreateSaleResult {
  const errors: SaleValidationError[] = [];
  const id = input.id.trim();
  const eventId = input.eventId.trim();
  const cashSessionId = input.cashSessionId.trim();
  const items = input.items.map(normalizeSaleItem);

  if (!id) {
    errors.push({ field: "id", message: "Sale id is required." });
  }

  if (!eventId) {
    errors.push({ field: "eventId", message: "Sale event id is required." });
  }

  if (!cashSessionId) {
    errors.push({
      field: "cashSessionId",
      message: "Sale cash session id is required.",
    });
  }

  if (!isValidDate(input.completedAt)) {
    errors.push({
      field: "completedAt",
      message: "Sale completion date must be valid.",
    });
  }

  if (items.length === 0) {
    errors.push({
      field: "items",
      message: "Sale must have at least one item.",
    });
  }

  for (const item of items) {
    validateSaleItem(item, errors);
  }

  if (!Number.isFinite(input.payment.amountInReais)) {
    errors.push({
      field: "payment",
      message: "Payment amount must be a valid BRL amount.",
    });
  }

  if (input.payment.amountInReais < 0) {
    errors.push({
      field: "payment",
      message: "Payment amount cannot be negative.",
    });
  }

  if (
    Number.isFinite(input.payment.amountInReais) &&
    !hasBrlPrecision(input.payment.amountInReais)
  ) {
    errors.push({
      field: "payment",
      message: "Payment amount can have at most 2 decimal places.",
    });
  }

  const totalInReais = roundBrl(
    items.reduce((total, item) => total + item.totalInReais, 0),
  );

  if (items.length > 0 && Number.isFinite(input.payment.amountInReais)) {
    validatePaymentAgainstTotal(input.payment, totalInReais, errors);
  }

  if (errors.length > 0) {
    return {
      errors,
      success: false,
    };
  }

  return {
    sale: {
      cashSessionId,
      completedAt: input.completedAt,
      eventId,
      id,
      items,
      payment: {
        amountInReais: input.payment.amountInReais,
        changeInReais: getPaymentChangeInReais(input.payment, totalInReais),
        method: input.payment.method,
      },
      status: "completed",
      totalInReais,
    },
    success: true,
  };
}

function normalizeSaleItem(input: CreateSaleItemInput): SaleItem {
  return {
    productId: input.productId.trim(),
    productName: input.productName.trim(),
    quantity: input.quantity,
    totalInReais: roundBrl(input.quantity * input.unitPriceInReais),
    unitPriceInReais: input.unitPriceInReais,
  };
}

function validateSaleItem(item: SaleItem, errors: SaleValidationError[]): void {
  if (!item.productId || !item.productName) {
    errors.push({
      field: "items",
      message: "Sale item product data is required.",
    });
  }

  if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
    errors.push({
      field: "items",
      message: "Sale item quantity must be a positive integer.",
    });
  }

  if (!Number.isFinite(item.unitPriceInReais) || item.unitPriceInReais < 0) {
    errors.push({
      field: "items",
      message: "Sale item unit price must be a valid BRL amount.",
    });
  }

  if (
    Number.isFinite(item.unitPriceInReais) &&
    !hasBrlPrecision(item.unitPriceInReais)
  ) {
    errors.push({
      field: "items",
      message: "Sale item unit price can have at most 2 decimal places.",
    });
  }
}

function validatePaymentAgainstTotal(
  payment: CreatePaymentInput,
  totalInReais: number,
  errors: SaleValidationError[],
): void {
  if (payment.method === "cash") {
    if (payment.amountInReais < totalInReais) {
      errors.push({
        field: "payment",
        message: "Payment amount must cover the sale total.",
      });
    }

    return;
  }

  if (payment.amountInReais !== totalInReais) {
    errors.push({
      field: "payment",
      message: "Non-cash payments must match the sale total exactly.",
    });
  }
}

function getPaymentChangeInReais(
  payment: CreatePaymentInput,
  totalInReais: number,
): number {
  if (payment.method !== "cash") {
    return 0;
  }

  return roundBrl(payment.amountInReais - totalInReais);
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function hasBrlPrecision(amountInReais: number): boolean {
  const cents = amountInReais * 100;

  return Math.abs(cents - Math.round(cents)) < 1e-8;
}

function roundBrl(amountInReais: number): number {
  return Math.round(amountInReais * 100) / 100;
}
