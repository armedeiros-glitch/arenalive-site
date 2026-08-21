import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DIAG_TOKEN = "EOgx9JmZa1k0rPePTGsYuunVyQB0hmpI";
const DIAG_EMAIL = "arenaliveoficial@gmail.com";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== DIAG_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: DIAG_EMAIL,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: "https://cotapeca.arenalivebrasil.com.br/auth/confirm?next=/account",
    },
  });

  return NextResponse.json({ ok: !error, error: error?.message ?? null });
}
