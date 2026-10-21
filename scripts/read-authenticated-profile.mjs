export async function readAuthenticatedProfile(client, userId) {
  const { data, error } = await client
    .from("profiles")
    .select("id,role")
    .eq("id", userId)
    .single();
  if (error) throw new Error("Unable to read the admin profile.");
  return data;
}
