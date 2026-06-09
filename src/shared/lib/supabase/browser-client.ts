import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/shared/lib/env";

export function createSupabaseBrowserClient() {
  const env = getPublicEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
