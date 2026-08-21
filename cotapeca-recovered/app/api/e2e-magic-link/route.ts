import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKEN = "s2-e2e-20260821-7fd913c4";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: "arenaliveoficial@gmail.com",
    options: {
      shouldCreateUser: false,
      emailRedirectTo: "https://cotapeca.arenalivebrasil.com.br/auth/confirm?next=/supplier/opportunities",
    },
  });

  return NextResponse.json({ ok: !error, error: error?.message ?? null });
}
