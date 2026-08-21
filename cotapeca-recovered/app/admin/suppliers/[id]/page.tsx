'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type SupplierStatus = 'verified' | 'rejected' | 'blocked';

type SupplierDetail = {
  id: string;
  trade_name: string;
  legal_name: string;
  cnpj_normalized: string;
  responsible_name: string;
  city: string;
  state: string;
  verification_status: string;
};

export default function AdminSupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [msg, setMsg] = useState('Carregando…');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id,trade_name,legal_name,cnpj_normalized,responsible_name,city,state,verification_status')
      .eq('id', id)
      .single();
    return data as SupplierDetail | null;
  }, [id, supabase]);

  useEffect(() => {
    let active = true;
    void load().then((data) => {
      if (!active) return;
      if (data) {
        setSupplier(data);
        setMsg('');
      } else {
        setSupplier(null);
        setMsg('Fornecedor não encontrado ou acesso negado.');
      }
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function change(status: SupplierStatus) {
    const { error } = await supabase.rpc('admin_set_supplier_status', {
      p_supplier_id: id,
      p_status: status,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    const data = await load();
    setSupplier(data);
    setMsg(`Status alterado para ${status}.`);
  }

  if (!supplier) return <main className="p-6">{msg}</main>;

  return (
    <main className="min-h-screen bg-[#f6f2e9] p-5">
      <section className="mx-auto max-w-3xl">
        <Link href="/admin/suppliers" className="text-sm font-bold text-black/50">← Fornecedores</Link>
        <div className="mt-5 rounded-3xl bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-black">{supplier.trade_name}</h1>
          <p className="mt-1 text-black/55">{supplier.legal_name}</p>
          <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-black/45">CNPJ</dt><dd className="font-bold">{supplier.cnpj_normalized}</dd></div>
            <div><dt className="text-black/45">Responsável</dt><dd className="font-bold">{supplier.responsible_name}</dd></div>
            <div><dt className="text-black/45">Cidade</dt><dd className="font-bold">{supplier.city}/{supplier.state}</dd></div>
            <div><dt className="text-black/45">Status</dt><dd data-testid="supplier-status" className="font-bold">{supplier.verification_status}</dd></div>
          </dl>
          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            <button data-testid="approve" onClick={() => change('verified')} className="rounded-xl bg-green-700 px-4 py-3 font-bold text-white">Aprovar</button>
            <button data-testid="reject" onClick={() => change('rejected')} className="rounded-xl border px-4 py-3 font-bold">Rejeitar</button>
            <button data-testid="block" onClick={() => change('blocked')} className="rounded-xl bg-black px-4 py-3 font-bold text-white">Bloquear</button>
          </div>
          {msg && <p data-testid="admin-message" className="mt-4 text-sm font-bold">{msg}</p>}
        </div>
      </section>
    </main>
  );
}
