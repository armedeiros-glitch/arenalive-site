'use client';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function TestSessionContent() {
  const q = useSearchParams();

  useEffect(() => {
    const email = q.get('email');
    const password = q.get('password');
    const next = q.get('next') || '/';

    const isLocalE2E = process.env.NEXT_PUBLIC_E2E_MODE === 'true';
    const isDisposableProdE2E = Boolean(email?.endsWith('@cotapeca.test'));

    if (!isLocalE2E && !isDisposableProdE2E) {
      location.href = '/';
      return;
    }

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
