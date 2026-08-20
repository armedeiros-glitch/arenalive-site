type ServerEnv = {
  supabaseUrl: string;
  serviceRoleKey: string;
  appEnv: "development" | "staging" | "production";
};

const VALID_APP_ENVS = new Set(["development", "staging", "production"]);

export function requireServerEnv(): ServerEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const rawAppEnv = process.env.APP_ENV ?? "development";

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  if (!VALID_APP_ENVS.has(rawAppEnv)) throw new Error("Invalid APP_ENV");

  return {
    supabaseUrl,
    serviceRoleKey,
    appEnv: rawAppEnv as ServerEnv["appEnv"],
  };
}
