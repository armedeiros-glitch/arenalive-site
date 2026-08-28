import { redirect } from "next/navigation";
import type { Role } from "@/lib/auth/roles";
import { canActAs, isRole } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export async function requireRole(required: Role) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("auth_user_id", authData.user.id)
    .is("deleted_at", null)
    .single();

  if (
    profileError ||
    !profile ||
    profile.status !== "active" ||
    !isRole(profile.role) ||
    !canActAs(profile.role, required)
  ) {
    redirect("/");
  }

  return { user: authData.user, profile };
}
