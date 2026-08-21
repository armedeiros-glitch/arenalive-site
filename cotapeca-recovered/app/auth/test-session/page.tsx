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
    const action = q.get('action');
    const opportunityId = q.get('opportunity');

    const isLocalE2E = process.env.NEXT_PUBLIC_E2E_MODE === 'true';
    const isDisposableProdE2E = Boolean(email?.endsWith('@cotapeca.test'));

    if (!isLocalE2E && !isDisposableProdE2E) {
      location.href = '/';
      return;
    }

    if (!email || !password) return;

    const supabase = createClient();
    supabase.auth.signInWithPassword({ email, password }).then(async ({ error }) => {
      document.body.dataset.auth = error ? 'error' : 'ok';
      if (error) return;

      if (action === 'decline' && opportunityId) {
        const { error: declineError } = await supabase.rpc('decline_opportunity', {
          p_opportunity_id: opportunityId,
        });
        document.body.dataset.decline = declineError ? 'error' : 'ok';
      }

      location.href = next;
    });
  }, [q]);

  return <main className="p-6">Executando cenário de teste…</main>;
}

export default function TestSession() {
  return (
    <Suspense fallback={<main className="p-6">Executando cenário de teste…</main>}>
      <TestSessionContent />
    </Suspense>
  );
}
