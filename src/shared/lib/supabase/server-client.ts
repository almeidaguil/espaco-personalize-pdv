import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/shared/lib/env";

export function createSupabaseServerClient() {
  const env = getPublicEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
      },
    },
  );
}
