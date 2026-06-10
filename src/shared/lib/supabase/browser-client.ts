import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/shared/lib/env";

export function createSupabaseBrowserClient() {
  const env = getPublicEnv();

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
