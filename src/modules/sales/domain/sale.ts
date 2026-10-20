import {
  paymentMethods,
  type InstallmentCount,
  type PaymentMethod,
} from "@/shared/types/payment-method";

export {
  paymentMethods,
  type InstallmentCount,
  type PaymentMethod,
} from "@/shared/types/payment-method";

export type SaleStatus = "completed" | "canceled";

export type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  totalInCents: number;
  unitPriceInCents: number;
};

type NonCreditPaymentMethod = Exclude<PaymentMethod, "credit_card">;

export type Payment = {
  amountInCents: number;
  changeInCents: number;
} & (
  | {
      installmentCount: InstallmentCount;
      method: "credit_card";
    }
  | {
      installmentCount?: never;
      method: NonCreditPaymentMethod;
    }
);

export type Sale = {
  cashSessionId: string;
  completedAt: Date;
  discountInCents: number;
  id: string;
  items: SaleItem[];
  payments: Payment[];
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
} & (
  | {
      installmentCount: InstallmentCount;
      method: "credit_card";
    }
  | {
      installmentCount?: never;
      method: NonCreditPaymentMethod;
    }
);

export type CreateSaleInput = {
  cashSessionId: string;
  completedAt: Date;
  discountInCents: number;
  id: string;
  items: CreateSaleItemInput[];
  payments: CreatePaymentInput[];
};

export type SaleValidationError = {
  field:
    | "cashSessionId"
    | "completedAt"
    | "discount"
    | "id"
    | "items"
    | "payments";
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

  const hasValidPaymentCollection = validatePaymentCollection(
    input.payments,
    errors,
  );

  const totalInCents = subtotalInCents - input.discountInCents;
  let payments: Payment[] = [];

  if (
    hasValidSubtotal &&
    hasValidDiscount &&
    input.discountInCents < subtotalInCents &&
    hasValidPaymentCollection
  ) {
    payments = normalizePayments(input.payments, totalInCents, errors);
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
      payments,
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

function validatePaymentCollection(
  payments: CreatePaymentInput[],
  errors: SaleValidationError[],
): boolean {
  if (!Array.isArray(payments) || payments.length < 1 || payments.length > 2) {
    errors.push({
      field: "payments",
      message: "Sale must have one or two payments.",
    });
    return false;
  }

  if (
    payments.some(
      (payment) =>
        !Number.isSafeInteger(payment.amountInCents) ||
        payment.amountInCents < 0,
    )
  ) {
    errors.push({
      field: "payments",
      message: "Payment amount must be a positive safe integer.",
    });
    return false;
  }

  if (
    payments.some(
      (payment) => !paymentMethods.includes(payment.method as PaymentMethod),
    )
  ) {
    errors.push({ field: "payments", message: "Payment method is invalid." });
    return false;
  }

  if (
    new Set(payments.map((payment) => payment.method)).size !== payments.length
  ) {
    errors.push({
      field: "payments",
      message: "Payment methods must be distinct.",
    });
    return false;
  }

  const hasInvalidInstallment = payments.some((payment) =>
    payment.method === "credit_card"
      ? ![1, 2, 3].includes(payment.installmentCount as number)
      : payment.installmentCount !== undefined,
  );

  if (hasInvalidInstallment) {
    errors.push({
      field: "payments",
      message:
        "Credit installments must be 1, 2 or 3 and exclusive to credit card payments.",
    });
    return false;
  }

  return true;
}

function normalizePayments(
  inputs: CreatePaymentInput[],
  totalInCents: number,
  errors: SaleValidationError[],
): Payment[] {
  if (inputs.some((payment) => payment.amountInCents === 0)) {
    errors.push({
      field: "payments",
      message: "Payment amount must be a positive safe integer.",
    });
    return [];
  }

  const grossAmountInCents = inputs.reduce(
    (total, payment) => total + payment.amountInCents,
    0,
  );

  if (!Number.isSafeInteger(grossAmountInCents)) {
    errors.push({
      field: "payments",
      message: "Payment total exceeds the supported range.",
    });
    return [];
  }

  const cashPayment = inputs.find((payment) => payment.method === "cash");
  if (
    grossAmountInCents < totalInCents ||
    (!cashPayment && grossAmountInCents !== totalInCents)
  ) {
    errors.push({
      field: "payments",
      message: "Payment contributions must match the sale total exactly.",
    });
    return [];
  }

  const changeInCents = cashPayment ? grossAmountInCents - totalInCents : 0;
  const normalized = inputs.map((payment): Payment => {
    const change = payment.method === "cash" ? changeInCents : 0;

    return payment.method === "credit_card"
      ? {
          amountInCents: payment.amountInCents,
          changeInCents: change,
          installmentCount: payment.installmentCount,
          method: payment.method,
        }
      : {
          amountInCents: payment.amountInCents,
          changeInCents: change,
          method: payment.method,
        };
  });

  if (
    normalized.some(
      (payment) => payment.amountInCents - payment.changeInCents < 1,
    )
  ) {
    errors.push({
      field: "payments",
      message: "Each payment must contribute at least one cent.",
    });
    return [];
  }

  const netAmountInCents = normalized.reduce(
    (total, payment) => total + payment.amountInCents - payment.changeInCents,
    0,
  );
  if (
    !Number.isSafeInteger(netAmountInCents) ||
    netAmountInCents !== totalInCents
  ) {
    errors.push({
      field: "payments",
      message: "Payment contributions must match the sale total exactly.",
    });
    return [];
  }

  return normalized;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}
