"use server";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server-client";

export async function logoutAction() {
  const supabaseClient = await createSupabaseServerClient();

  await supabaseClient.auth.signOut();

  redirect("/login");
}
