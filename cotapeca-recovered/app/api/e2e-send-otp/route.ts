import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: 'arenaliveoficial@gmail.com',
    options: {
      shouldCreateUser: true,
      emailRedirectTo: 'https://cotapeca.arenalivebrasil.com.br/auth/confirm?next=/supplier/opportunities',
    },
  });

  return NextResponse.json({ ok: !error, error: error?.message ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
