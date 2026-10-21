import { z } from "zod";
import { installmentCounts } from "@/shared/types/payment-method";

const amountInCentsSchema = z
  .number()
  .int("Informe um valor recebido em centavos inteiros.")
  .nonnegative("O valor recebido nao pode ser negativo.")
  .safe("O valor recebido informado e muito alto.");

const nonCreditPaymentSchemas = ["cash", "pix", "debit_card"].map((method) =>
  z.object({
    amountInCents: amountInCentsSchema,
    installmentCount: z.never().optional(),
    method: z.literal(method as "cash" | "pix" | "debit_card"),
  }),
);

const paymentSchema = z.discriminatedUnion("method", [
  nonCreditPaymentSchemas[0],
  nonCreditPaymentSchemas[1],
  nonCreditPaymentSchemas[2],
  z.object({
    amountInCents: amountInCentsSchema,
    installmentCount: z.union(
      installmentCounts.map((count) => z.literal(count)) as [
        z.ZodLiteral<1>,
        z.ZodLiteral<2>,
        z.ZodLiteral<3>,
      ],
    ),
    method: z.literal("credit_card"),
  }),
]);

const canonicalCreateSaleSchema = z.object({
  discountInCents: z
    .number()
    .int("Informe o desconto em centavos inteiros.")
    .nonnegative("O desconto nao pode ser negativo.")
    .safe("O desconto informado e muito alto."),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1, "Informe o produto."),
        quantity: z
          .number()
          .int("Informe uma quantidade inteira.")
          .positive("A quantidade deve ser maior que zero."),
      }),
    )
    .min(1, "Adicione pelo menos um item."),
  payments: z
    .array(paymentSchema)
    .min(1, "Informe ao menos uma forma de pagamento.")
    .max(2, "Informe no maximo duas formas de pagamento.")
    .superRefine((payments, context) => {
      if (
        new Set(payments.map((payment) => payment.method)).size !==
        payments.length
      ) {
        context.addIssue({
          code: "custom",
          message: "As formas de pagamento devem ser diferentes.",
        });
      }
    }),
});

export const createSaleSchema = z.preprocess((input) => {
  if (!isRecord(input) || "payments" in input || !("payment" in input)) {
    return input;
  }

  const { payment, ...rest } = input;

  return {
    ...rest,
    payments: [payment],
  };
}, canonicalCreateSaleSchema);

export type CreateSaleUseCaseInput = z.infer<typeof createSaleSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
