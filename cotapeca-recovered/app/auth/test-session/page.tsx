'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function TestSessionContent() {
  const q = useSearchParams();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_MODE !== 'true') {
      location.href = '/';
      return;
    }

    const email = q.get('email');
    const password = q.get('password');
    const next = q.get('next') || '/';
    if (!email || !password) return;

    createClient()
      .auth.signInWithPassword({ email, password })
      .then(({ error }) => {
        document.body.dataset.auth = error ? 'error' : 'ok';
        if (!error) location.href = next;
      });
  }, [q]);

  return <main className="p-6">Entrando no ambiente de teste…</main>;
}

export default function TestSession() {
  return (
    <Suspense fallback={<main className="p-6">Entrando no ambiente de teste…</main>}>
      <TestSessionContent />
    </Suspense>
  );
}
