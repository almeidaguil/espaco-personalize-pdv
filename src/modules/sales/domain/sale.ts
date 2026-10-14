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
  totalInCents: number;
  unitPriceInCents: number;
};

export type Payment = {
  amountInCents: number;
  changeInCents: number;
  method: PaymentMethod;
};

export type Sale = {
  cashSessionId: string;
  completedAt: Date;
  discountInCents: number;
  id: string;
  items: SaleItem[];
  payment: Payment;
  status: SaleStatus;
  subtotalInCents: number;
  totalInCents: number;
};

export type CreateSaleItemInput = {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceInCents: number;
};

export type CreatePaymentInput = {
  amountInCents: number;
  method: PaymentMethod;
};

export type CreateSaleInput = {
  cashSessionId: string;
  completedAt: Date;
  discountInCents: number;
  id: string;
  items: CreateSaleItemInput[];
  payment: CreatePaymentInput;
};

export type SaleValidationError = {
  field:
    | "cashSessionId"
    | "completedAt"
    | "discount"
    | "id"
    | "items"
    | "payment";
  message: string;
};

export type CreateSaleResult =
  | { sale: Sale; success: true }
  | { errors: SaleValidationError[]; success: false };

export function createSale(input: CreateSaleInput): CreateSaleResult {
  const errors: SaleValidationError[] = [];
  const id = input.id.trim();
  const cashSessionId = input.cashSessionId.trim();
  const items = input.items.map(normalizeSaleItem);

  if (!id) {
    errors.push({ field: "id", message: "Sale id is required." });
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

  const subtotalInCents = items.reduce(
    (subtotal, item) => subtotal + item.totalInCents,
    0,
  );
  const canValidateSubtotal = items.every(
    (item) =>
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      Number.isSafeInteger(item.unitPriceInCents) &&
      item.unitPriceInCents >= 0 &&
      Number.isSafeInteger(item.totalInCents),
  );
  const hasValidSubtotal =
    items.length > 0 &&
    canValidateSubtotal &&
    Number.isSafeInteger(subtotalInCents) &&
    subtotalInCents > 0;

  if (items.length > 0 && canValidateSubtotal && subtotalInCents === 0) {
    errors.push({
      field: "items",
      message: "Sale subtotal must be greater than zero.",
    });
  }

  const hasValidDiscount =
    Number.isSafeInteger(input.discountInCents) && input.discountInCents >= 0;

  if (!hasValidDiscount) {
    errors.push({
      field: "discount",
      message: "Sale discount must be a non-negative integer.",
    });
  } else if (hasValidSubtotal && input.discountInCents >= subtotalInCents) {
    errors.push({
      field: "discount",
      message: "Sale discount must be lower than the subtotal.",
    });
  }

  const hasValidPayment =
    Number.isSafeInteger(input.payment.amountInCents) &&
    input.payment.amountInCents >= 0;

  if (!hasValidPayment) {
    errors.push({
      field: "payment",
      message: "Payment amount must be a non-negative integer.",
    });
  }

  const totalInCents = subtotalInCents - input.discountInCents;

  if (
    hasValidSubtotal &&
    hasValidDiscount &&
    input.discountInCents < subtotalInCents &&
    hasValidPayment
  ) {
    validatePaymentAgainstTotal(input.payment, totalInCents, errors);
  }

  if (errors.length > 0) {
    return { errors, success: false };
  }

  return {
    sale: {
      cashSessionId,
      completedAt: input.completedAt,
      discountInCents: input.discountInCents,
      id,
      items,
      payment: {
        amountInCents: input.payment.amountInCents,
        changeInCents: getPaymentChangeInCents(input.payment, totalInCents),
        method: input.payment.method,
      },
      status: "completed",
      subtotalInCents,
      totalInCents,
    },
    success: true,
  };
}

function normalizeSaleItem(input: CreateSaleItemInput): SaleItem {
  return {
    productId: input.productId.trim(),
    productName: input.productName.trim(),
    quantity: input.quantity,
    totalInCents: input.quantity * input.unitPriceInCents,
    unitPriceInCents: input.unitPriceInCents,
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

  if (
    !Number.isSafeInteger(item.unitPriceInCents) ||
    item.unitPriceInCents < 0
  ) {
    errors.push({
      field: "items",
      message: "Sale item unit price must be a non-negative integer.",
    });
  }

  if (!Number.isSafeInteger(item.totalInCents)) {
    errors.push({
      field: "items",
      message: "Sale item total exceeds the supported range.",
    });
  }
}

function validatePaymentAgainstTotal(
  payment: CreatePaymentInput,
  totalInCents: number,
  errors: SaleValidationError[],
): void {
  if (payment.method === "cash") {
    if (payment.amountInCents < totalInCents) {
      errors.push({
        field: "payment",
        message: "Payment amount must cover the sale total.",
      });
    }

    return;
  }

  if (payment.amountInCents !== totalInCents) {
    errors.push({
      field: "payment",
      message: "Non-cash payments must match the sale total exactly.",
    });
  }
}

function getPaymentChangeInCents(
  payment: CreatePaymentInput,
  totalInCents: number,
): number {
  return payment.method === "cash" ? payment.amountInCents - totalInCents : 0;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
