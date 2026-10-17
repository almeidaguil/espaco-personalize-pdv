import type { PaymentMethod } from "../domain/sale";
import { parseBrlCurrencyToCents } from "@/shared/utils/brl-currency";

type SaleItemFormInput = {
  productId: string;
  quantity: number;
};

export function parseCreateSaleFormData(formData: FormData) {
  return {
    discountInCents: parseDiscountInCents(
      formData.get("discountInReais")?.toString() ?? "",
    ),
    items: parseSaleItems(formData.get("itemsJson")?.toString() ?? "[]"),
    payment: {
      amountInCents: parseBrlCurrencyToCents(
        formData.get("amountReceivedInReais")?.toString() ?? "",
      ),
      method: parsePaymentMethod(formData.get("paymentMethod")?.toString()),
    },
  };
}

function parseSaleItems(value: string): SaleItemFormInput[] {
  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((item) => ({
      productId: isRecord(item) ? String(item.productId ?? "") : "",
      quantity: isRecord(item) ? Number(item.quantity) : Number.NaN,
    }));
  } catch {
    return [];
  }
}

function parseDiscountInCents(value: string): number {
  return value.trim() ? parseBrlCurrencyToCents(value) : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePaymentMethod(value?: string): PaymentMethod {
  switch (value) {
    case "pix":
    case "credit_card":
    case "debit_card":
      return value;
    default:
      return "cash";
  }
}
