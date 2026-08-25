'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type BuyerQuote = {
  id:string;
  public_code:string;
  status:string;
  city:string;
  state:string;
  created_at:string;
  expires_at:string;
  item_count:number;
  offer_count:number;
  last_offer_at:string|null;
  vehicle:{brand_name:string;model:string;year:number;version:string};
};

function relativeTime(value:string|null) {
  if (!value) return '';
  const diff=Math.max(0,Date.now()-new Date(value).getTime());
  const mins=Math.floor(diff/60000);
  if (mins<1) return 'agora';
  if (mins<60) return `há ${mins} min`;
  const hours=Math.floor(mins/60);
  if (hours<24) return `há ${hours}h`;
  const days=Math.floor(hours/24);
  return `há ${days}d`;
}

export default function BuyerQuotesPage() {
  const supabase=useMemo(()=>createClient(),[]);
  const [quotes,setQuotes]=useState<BuyerQuote[]>([]);
  const [state,setState]=useState('Carregando seus pedidos…');

  useEffect(()=>{
    let alive=true;
    void (async()=>{
      const {data:user}=await supabase.auth.getUser();
      if (!user.user) { location.href='/auth/login?next=/buyer/quotes'; return; }
      const {data,error}=await supabase.rpc('list_buyer_quotes');
      if (!alive) return;
      if (error) { setState('Não foi possível carregar seus pedidos.'); return; }
      setQuotes((data??[]) as BuyerQuote[]);
      setState('');
    })();
    return()=>{alive=false;};
  },[supabase]);

  return <main className="min-h-screen bg-[#f6f2e9] text-[#1b1d22]">
    <header className="border-b border-black/10 bg-white/80 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><Link href="/" className="text-xl font-black tracking-tight">Cota<span className="text-orange-600">Peça</span></Link><Link href="/cotacao" className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-black text-white">NOVO PEDIDO</Link></div></header>
    <section className="mx-auto max-w-5xl px-5 py-8">
      <p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-orange-600">Área do comprador</p>
      <h1 className="text-3xl font-black">Meus pedidos</h1>
      <p className="mt-2 text-black/55">Acompanhe as respostas das lojas e compare as opções em um só lugar.</p>

      {state && <div className="mt-7 rounded-3xl border border-black/10 bg-white p-6">{state}</div>}
      {!state && quotes.length===0 && <div className="mt-7 rounded-3xl border border-dashed border-black/20 bg-white/60 p-10 text-center"><p className="font-bold text-black/55">Você ainda não fez nenhum pedido.</p><Link href="/cotacao" className="mt-4 inline-block rounded-2xl bg-[#17191d] px-5 py-3 text-sm font-black text-white">FAZER PRIMEIRO PEDIDO</Link></div>}

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {quotes.map((quote)=><article key={quote.id} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[.15em] text-black/35">{quote.public_code}</p><h2 className="mt-1 text-xl font-black">{quote.vehicle.brand_name} {quote.vehicle.model} {quote.vehicle.year}</h2><p className="mt-1 text-sm text-black/50">{quote.vehicle.version}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${quote.offer_count>0?'bg-green-50 text-green-800':'bg-orange-50 text-orange-700'}`}>{quote.offer_count>0?`${quote.offer_count} ${quote.offer_count===1?'RESPOSTA':'RESPOSTAS'}`:'AGUARDANDO'}</span>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-black/55"><span>📍 {quote.city}/{quote.state}</span><span>{quote.item_count} {quote.item_count===1?'peça':'peças'}</span>{quote.last_offer_at && <span>Última resposta {relativeTime(quote.last_offer_at)}</span>}</div>
          <Link href={`/buyer/quotes/${quote.id}`} className="mt-6 block rounded-2xl bg-[#17191d] px-5 py-3 text-center text-sm font-black text-white">{quote.offer_count>0?'COMPARAR PROPOSTAS':'ACOMPANHAR PEDIDO'}</Link>
        </article>)}
      </div>
    </section>
  </main>;
}
