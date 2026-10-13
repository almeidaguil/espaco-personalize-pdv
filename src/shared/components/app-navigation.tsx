import {
  SupabaseCurrentUserProfileRepository,
  type SupabaseCurrentUserProfileClient,
} from "@/modules/auth/infra/supabase-current-user-profile-repository";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

import { AppHeader } from "./app-header";

type AppNavigationProps = {
  eyebrow?: string;
  title: string;
};

export async function AppNavigation({ eyebrow, title }: AppNavigationProps) {
  const supabaseClient = await createSupabaseServerClient();

  const currentUserProfileRepository = new SupabaseCurrentUserProfileRepository(
    supabaseClient as unknown as SupabaseCurrentUserProfileClient,
  );

  const currentUserResult = await currentUserProfileRepository.getCurrent();

  const isAdmin =
    currentUserResult.success && currentUserResult.profile.role === "admin";

  return (
    <AppHeader eyebrow={eyebrow} showAdminNavigation={isAdmin} title={title} />
  );
}
