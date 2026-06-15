import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SECRET_KEY: z
    .string()
    .trim()
    .min(1, "SUPABASE_SECRET_KEY is required"),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parsePublicEnv(
  env: Record<string, string | undefined>,
): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv(process.env);
}

export function parseServerEnv(
  env: Record<string, string | undefined>,
): ServerEnv {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
  });
}

export function getServerEnv(): ServerEnv {
  return parseServerEnv(process.env);
}
