'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type SupplierRow = {
  id: string;
  trade_name: string;
  legal_name: string;
  city: string;
  state: string;
  verification_status: string;
  created_at: string;
};

export default function AdminSuppliers() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [msg, setMsg] = useState('Carregando…');

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('suppliers')
        .select('id,trade_name,legal_name,city,state,verification_status,created_at')
        .order('created_at', { ascending: false });
      if (!active) return;
      if (data) {
        setRows(data as SupplierRow[]);
        setMsg('');
      } else {
        setMsg('Acesso administrativo necessário.');
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-[#f6f2e9] p-5">
      <section className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-black">Fornecedores</h1>
        <p className="mt-2 text-black/50">Aprovação e segurança operacional.</p>
        {msg && <p className="mt-6">{msg}</p>}
        <div className="mt-6 grid gap-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/admin/suppliers/${row.id}`} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex justify-between gap-4">
                <div>
                  <b className="text-lg">{row.trade_name}</b>
                  <p className="text-sm text-black/50">{row.legal_name} · {row.city}/{row.state}</p>
                </div>
                <span className="text-xs font-black uppercase">{row.verification_status}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
