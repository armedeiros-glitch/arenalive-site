'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CONDITION_LABELS, relativeTime } from '@/lib/sprint2/format';

type Offer = { id:string; opportunity_id:string; quote_id:string; status:string; notes:string|null; created_at:string };
type OfferItem = { offer_id:string; quote_item_id:string; price_cents:number; condition:string; brand_name:string; availability_days:number; delivery_method:string };
type Card = Offer & { vehicle:string; lines:Array<{name:string; price_cents:number; condition:string; brand_name:string}>; total:number };

function money(cents:number) {
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
}

export default function SupplierOffersPage() {
  const supabase = useMemo(()=>createClient(),[]);
  const [cards,setCards] = useState<Card[]>([]);
  const [state,setState] = useState('Carregando propostas…');
  const [created] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('created')==='1');

  useEffect(()=>{
    let alive=true;
    void (async()=>{
      const { data:user } = await supabase.auth.getUser();
      if (!user.user) { location.href='/auth/login?next=/supplier/offers'; return; }
      const { data:supplier } = await supabase.from('suppliers').select('id,verification_status').maybeSingle();
      if (!supplier) { location.href='/supplier/register'; return; }
      if (supplier.verification_status!=='verified') { setState('Seu cadastro ainda não está aprovado.'); return; }

      const { data:offersData,error } = await supabase.from('offers').select('id,opportunity_id,quote_id,status,notes,created_at').order('created_at',{ascending:false});
      if (error) { setState('Não foi possível carregar suas propostas.'); return; }
      const offers=(offersData??[]) as Offer[];
      const result:Card[]=[];

      for (const offer of offers) {
        const [{data:quote},{data:itemRows}] = await Promise.all([
          supabase.from('quotes').select('vehicle_id').eq('id',offer.quote_id).maybeSingle(),
          supabase.from('offer_items').select('offer_id,quote_item_id,price_cents,condition,brand_name,availability_days,delivery_method').eq('offer_id',offer.id),
        ]);
        const {data:vehicle}=await supabase.from('vehicles').select('brand_name,model,year').eq('id',quote?.vehicle_id??'').maybeSingle();
        const lines=[];
        for (const row of (itemRows??[]) as OfferItem[]) {
          const {data:quoteItem}=await supabase.from('quote_items').select('piece_name').eq('id',row.quote_item_id).maybeSingle();
          lines.push({name:quoteItem?.piece_name??'Peça',price_cents:row.price_cents,condition:row.condition,brand_name:row.brand_name});
        }
        result.push({...offer,vehicle:vehicle?`${vehicle.brand_name} ${vehicle.model} ${vehicle.year}`:'Veículo',total:lines.reduce((sum,line)=>sum+line.price_cents,0),lines});
      }
      if (alive) { setCards(result); setState(''); }
    })();
    return()=>{alive=false;};
  },[supabase]);

  return <main className="min-h-screen bg-[#f6f2e9] text-[#1b1d22]">
    <header className="border-b border-black/10 bg-white/80 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><Link href="/" className="text-xl font-black tracking-tight">Cota<span className="text-orange-600">Peça</span></Link><Link href="/supplier/opportunities" className="text-sm font-black text-black/55">Oportunidades</Link></div></header>
    <section className="mx-auto max-w-5xl px-5 py-8">
      <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-orange-600">Painel fornecedor</p>
      <h1 className="text-3xl font-black">Minhas propostas</h1>
      <p className="mt-2 text-black/55">O que você já respondeu fica organizado aqui.</p>
      {created && <div data-testid="offer-created-success" className="mt-5 rounded-2xl bg-green-50 px-4 py-3 text-sm font-bold text-green-800">Proposta enviada com sucesso.</div>}
      {state && <div className="mt-7 rounded-3xl border border-black/10 bg-white p-6">{state}</div>}
      {!state && cards.length===0 && <div className="mt-7 rounded-3xl border border-dashed border-black/20 bg-white/60 p-10 text-center text-black/55">Você ainda não enviou propostas.</div>}
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {cards.map(card=><article key={card.id} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-black">{card.vehicle}</h2><p className="mt-1 text-sm text-black/50">Enviada {relativeTime(card.created_at)}</p></div><span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-800">ENVIADA</span></div>
          <div className="mt-5 grid gap-3">{card.lines.map((line,index)=><div key={`${line.name}-${index}`} className="rounded-2xl bg-[#f6f2e9] p-4"><div className="flex items-start justify-between gap-3"><b>{line.name}</b><b>{money(line.price_cents)}</b></div><p className="mt-1 text-xs text-black/55">{line.brand_name} · {CONDITION_LABELS[line.condition]??line.condition}</p></div>)}</div>
          <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4"><span className="text-sm font-bold text-black/50">Total cotado</span><strong className="text-xl">{money(card.total)}</strong></div>
          <Link href={`/supplier/opportunities/${card.opportunity_id}`} className="mt-5 block rounded-2xl border border-black/15 px-5 py-3 text-center text-sm font-black">VER COTAÇÃO</Link>
        </article>)}
      </div>
    </section>
  </main>;
}
