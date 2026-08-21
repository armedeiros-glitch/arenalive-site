'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { kmLabel, relativeTime } from '@/lib/sprint2/format';

type Opportunity = { id:string; quote_id:string; supplier_id?:string; status:string; distance_km:number|null; sent_at:string; matching_context:Record<string,unknown> };
type Card = Opportunity & { vehicle:string; item:string; city:string };

async function hydrate(supabase: ReturnType<typeof createClient>, rows: Opportunity[]): Promise<Card[]> {
  return Promise.all(rows.map(async (row) => {
    const { data: quote } = await supabase.from('quotes').select('id,city,vehicle_id').eq('id', row.quote_id).single();
    const [{ data: vehicle }, { data: items }] = await Promise.all([
      supabase.from('vehicles').select('brand_name,model,year').eq('id', quote?.vehicle_id ?? '').maybeSingle(),
      supabase.from('quote_items').select('piece_name').eq('quote_id', row.quote_id).order('sort_order').limit(1),
    ]);
    return { ...row, vehicle: vehicle ? `${vehicle.brand_name} ${vehicle.model} ${vehicle.year}` : 'Veículo', item: items?.[0]?.piece_name ?? 'Peça solicitada', city: quote?.city ?? '' };
  }));
}

export default function OpportunitiesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [cards,setCards] = useState<Card[]>([]);
  const [state,setState] = useState('Carregando oportunidades…');
  useEffect(() => {
    let alive = true;
    async function load() {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) { location.href='/auth/login?next=/supplier/opportunities'; return; }
      const { data: supplier } = await supabase.from('suppliers').select('id,verification_status,trade_name').maybeSingle();
      if (!supplier) { location.href='/supplier/register'; return; }
      if (supplier.verification_status !== 'verified') { setState('Seu cadastro ainda não está aprovado.'); return; }
      const { data } = await supabase.from('opportunities').select('id,quote_id,status,distance_km,sent_at,matching_context').in('status',['sent','viewed']).order('sent_at',{ascending:false});
      if (alive) { setCards(await hydrate(supabase,(data ?? []) as Opportunity[])); setState(''); }
      const channel = supabase.channel(`supplier-opportunities-${supplier.id}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'opportunities'},async (payload) => {
          const opportunity = payload.new as Opportunity;
          if (opportunity.supplier_id && opportunity.supplier_id !== supplier.id) return;
          const next = await hydrate(supabase,[opportunity]);
          if (alive) { setCards((current) => [next[0],...current.filter(x=>x.id!==next[0].id)]); window.dispatchEvent(new CustomEvent('cotapeca:opportunity-realtime',{detail:payload.new})); }
        }).subscribe((status) => {
          if (alive && status === 'SUBSCRIBED') window.dispatchEvent(new CustomEvent('cotapeca:opportunity-realtime-ready'));
        });
      return () => { supabase.removeChannel(channel); };
    }
    let cleanup: void | (()=>void);
    load().then(fn=>{cleanup=fn;});
    return () => { alive=false; cleanup?.(); };
  },[supabase]);

  return <main className="min-h-screen bg-[#f6f2e9] text-[#1b1d22]">
    <header className="border-b border-black/10 bg-white/80 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between"><Link href="/" className="text-xl font-black tracking-tight">Cota<span className="text-orange-600">Peça</span></Link><span className="text-sm font-semibold text-black/50">Painel fornecedor</span></div></header>
    <section className="mx-auto max-w-5xl px-5 py-8"><div className="mb-7"><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-orange-600">Em tempo real</p><h1 className="text-3xl font-black">Oportunidades</h1><p className="mt-2 text-black/55">Pedidos compatíveis aparecem aqui automaticamente.</p></div>
      {state && <div className="rounded-3xl border border-black/10 bg-white p-6">{state}</div>}
      {!state && cards.length===0 && <div data-testid="empty-opportunities" className="rounded-3xl border border-dashed border-black/20 bg-white/60 p-10 text-center text-black/55">Nenhuma oportunidade disponível agora.</div>}
      <div className="grid gap-4 md:grid-cols-2">{cards.map(card=><article key={card.id} data-opportunity-id={card.id} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{card.vehicle}</h2><p className="mt-1 font-semibold text-black/70">{card.item}</p></div><span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">{card.status==='viewed'?'ABERTA':'NOVA'}</span></div><div className="mt-5 flex gap-4 text-sm text-black/55"><span>📍 {card.city}{card.distance_km!=null?` · ${kmLabel(card.distance_km)}`:''}</span><span>{relativeTime(card.sent_at)}</span></div><Link className="mt-6 block rounded-2xl bg-[#17191d] px-5 py-3 text-center text-sm font-black text-white" href={`/supplier/opportunities/${card.id}`}>VER COTAÇÃO</Link></article>)}</div>
    </section>
  </main>;
}
