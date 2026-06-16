import type { PaymentMethod } from "../domain/sale";

type SaleItemFormInput = {
  productId: string;
  quantity: number;
};

export function parseCreateSaleFormData(formData: FormData) {
  return {
    cashSessionId: formData.get("cashSessionId")?.toString() ?? "",
    eventId: formData.get("eventId")?.toString() ?? "",
    items: parseSaleItems(formData.get("itemsJson")?.toString() ?? "[]"),
    payment: {
      amountInReais: parseBrlAmount(
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

function parseBrlAmount(value: string): number {
  const normalizedValue = value.trim().replace(/\./g, "").replace(",", ".");

  if (!normalizedValue) {
    return Number.NaN;
  }

  return Number(normalizedValue);
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
