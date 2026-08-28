import { createClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env/server";

export function createAdminClient() {
  const env = requireServerEnv();

  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
