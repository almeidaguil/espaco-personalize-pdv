import { z } from "zod";

const validDateSchema = z
  .instanceof(Date, { message: "Informe uma data valida." })
  .refine((value) => Number.isFinite(value.getTime()), {
    message: "Informe uma data valida.",
  });

export const createEventSchema = z.object({
  endsAt: validDateSchema.optional().nullable(),
  isActive: z.boolean().optional(),
  location: z
    .string()
    .trim()
    .max(120, "O local deve ter no maximo 120 caracteres.")
    .optional()
    .nullable(),
  name: z.string().trim().min(1, "Informe o nome do evento."),
  startsAt: validDateSchema,
});

export type CreateEventUseCaseInput = z.infer<typeof createEventSchema>;
