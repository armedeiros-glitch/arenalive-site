"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/account";
  if (value === "/supplier/opportunities" || value.startsWith("/supplier/opportunities/")) return value;
  if (value === "/account" || value === "/") return value;
  return "/account";
}

export async function requestMagicLink(formData: FormData) {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const next = safeNextPath(formData.get("next"));

  if (!email || !email.includes("@") || email.length > 254) {
    redirect(`/auth/login?status=invalid-email&next=${encodeURIComponent(next)}`);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/auth/login?status=send-error&next=${encodeURIComponent(next)}`);
  }

  redirect(`/auth/login?status=sent&next=${encodeURIComponent(next)}`);
}
