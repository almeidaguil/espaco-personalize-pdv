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
    payments: parsePayments(formData.get("paymentsJson")?.toString() ?? "[]"),
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

function parsePayments(value: string) {
  try {
    const parsedValue: unknown = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((payment) => {
      const record = isRecord(payment) ? payment : {};
      const parsedPayment: {
        amountInCents: number;
        installmentCount?: number;
        method: string;
      } = {
        amountInCents: parseBrlCurrencyToCents(
          String(record.amountInReais ?? ""),
        ),
        method: String(record.method ?? ""),
      };

      if ("installmentCount" in record) {
        parsedPayment.installmentCount = Number(record.installmentCount);
      }

      return parsedPayment;
    });
  } catch {
    return [];
  }
}
