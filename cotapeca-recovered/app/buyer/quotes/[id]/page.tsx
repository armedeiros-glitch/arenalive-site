'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CONDITION_LABELS } from '@/lib/sprint2/format';

type OfferLine={
  offer_id:string;
  supplier_id:string;
  supplier_name:string;
  offer_created_at:string;
  price_cents:number;
  condition:string;
  brand_name:string;
  availability_days:number;
  delivery_method:'pickup'|'shipping'|'both';
  delivery_days:number|null;
  warranty_days:number|null;
  notes:string|null;
  photo_storage_keys:string[];
};
type QuoteItem={id:string;piece_name:string;side:string|null;notes:string|null;offers:OfferLine[]};
type Comparison={
  quote:{id:string;public_code:string;status:string;city:string;state:string;created_at:string;expires_at:string};
  vehicle:{brand_name:string;model:string;year:number;version:string};
  item_count:number;
  offer_count:number;
  items:QuoteItem[];
};

function money(cents:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);}
function availability(days:number){if(days===0)return 'Pronta entrega';if(days===1)return 'Em 1 dia';return `Em ${days} dias`;}
function delivery(line:OfferLine){
  const label=line.delivery_method==='pickup'?'Retirada':line.delivery_method==='shipping'?'Envio':'Retirada ou envio';
  if(line.delivery_method==='pickup'||line.delivery_days==null)return label;
  return `${label} · ${line.delivery_days===0?'no mesmo dia':`${line.delivery_days}d`}`;
}

export default function BuyerQuoteComparisonPage(){
  const {id}=useParams<{id:string}>();
  const supabase=useMemo(()=>createClient(),[]);
  const [data,setData]=useState<Comparison|null>(null);
  const [photoUrls,setPhotoUrls]=useState<Record<string,string>>({});
  const [state,setState]=useState('Carregando comparação…');

  useEffect(()=>{
    let alive=true;
    void (async()=>{
      const {data:user}=await supabase.auth.getUser();
      if(!user.user){location.href=`/auth/login?next=/buyer/quotes/${id}`;return;}
      const {data:comparison,error}=await supabase.rpc('get_quote_comparison',{p_quote_id:id});
      if(!alive)return;
      if(error||!comparison){setState('Pedido indisponível.');return;}
      const next=comparison as Comparison;
      setData(next);
      setState('');

      const urls:Record<string,string>={};
      for(const item of next.items){
        for(const offer of item.offers){
          const key=offer.photo_storage_keys[0];
          if(!key)continue;
          const {data:signed}=await supabase.storage.from('offer-photos').createSignedUrl(key,120);
          if(signed?.signedUrl)urls[`${item.id}:${offer.offer_id}`]=signed.signedUrl;
        }
      }
      if(alive)setPhotoUrls(urls);
    })();
    return()=>{alive=false;};
  },[id,supabase]);

  if(!data)return <main className="min-h-screen bg-[#f6f2e9] p-6 text-[#1b1d22]">{state}</main>;

  return <main className="min-h-screen bg-[#f6f2e9] text-[#1b1d22]">
    <header className="border-b border-black/10 bg-white/80 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><Link href="/" className="text-xl font-black tracking-tight">Cota<span className="text-orange-600">Peça</span></Link><Link href="/buyer/quotes" className="text-sm font-black text-black/55">Meus pedidos</Link></div></header>
    <section className="mx-auto max-w-5xl px-5 py-8">
      <Link href="/buyer/quotes" className="text-sm font-bold text-black/45">← Meus pedidos</Link>
      <div className="mt-5 rounded-[2rem] bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-orange-600">{data.quote.public_code}</p><h1 className="mt-1 text-3xl font-black">{data.vehicle.brand_name} {data.vehicle.model} {data.vehicle.year}</h1><p className="mt-1 text-black/50">{data.vehicle.version}</p></div>
          <span className={`rounded-full px-3 py-2 text-xs font-black ${data.offer_count>0?'bg-green-50 text-green-800':'bg-orange-50 text-orange-700'}`}>{data.offer_count>0?`${data.offer_count} ${data.offer_count===1?'LOJA RESPONDEU':'LOJAS RESPONDERAM'}`:'AGUARDANDO RESPOSTAS'}</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-4 rounded-2xl bg-[#f6f2e9] p-4 text-sm text-black/55"><span>📍 {data.quote.city}/{data.quote.state}</span><span>{data.item_count} {data.item_count===1?'peça solicitada':'peças solicitadas'}</span></div>
      </div>

      {data.offer_count===0 && <div className="mt-5 rounded-3xl border border-dashed border-black/20 bg-white/60 p-10 text-center"><h2 className="text-xl font-black">As lojas ainda estão respondendo.</h2><p className="mt-2 text-sm text-black/55">Quando chegar uma proposta, ela vai aparecer aqui para você comparar.</p></div>}

      <div className="mt-6 grid gap-6">
        {data.items.map((item)=><section key={item.id} className="rounded-[2rem] bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-black/35">Peça solicitada</p><h2 className="mt-1 text-2xl font-black">{item.piece_name}{item.side?` · ${item.side}`:''}</h2>{item.notes&&<p className="mt-1 text-sm text-black/50">{item.notes}</p>}</div><span className="text-sm font-bold text-black/45">{item.offers.length} {item.offers.length===1?'opção':'opções'}</span></div>

          {item.offers.length===0 && <div className="mt-5 rounded-2xl bg-[#f6f2e9] p-5 text-sm text-black/55">Nenhuma loja cotou esta peça ainda.</div>}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {item.offers.map((offer,index)=><article key={`${item.id}-${offer.offer_id}`} data-offer-id={offer.offer_id} className="rounded-3xl border border-black/10 p-5">
              <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-black">{offer.supplier_name}</h3>{index===0&&item.offers.length>1&&<span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-black text-green-800">MENOR PREÇO</span>}</div><p className="mt-1 text-xs text-black/45">{offer.brand_name} · {CONDITION_LABELS[offer.condition]??offer.condition}</p></div><strong className="text-xl">{money(offer.price_cents)}</strong></div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-[#f6f2e9] p-3"><span className="block text-[11px] font-bold uppercase tracking-wide text-black/35">Disponibilidade</span><b>{availability(offer.availability_days)}</b></div>
                <div className="rounded-xl bg-[#f6f2e9] p-3"><span className="block text-[11px] font-bold uppercase tracking-wide text-black/35">Entrega</span><b>{delivery(offer)}</b></div>
                <div className="rounded-xl bg-[#f6f2e9] p-3"><span className="block text-[11px] font-bold uppercase tracking-wide text-black/35">Garantia</span><b>{offer.warranty_days!=null?`${offer.warranty_days} dias`:'Não informada'}</b></div>
                <div className="rounded-xl bg-[#f6f2e9] p-3"><span className="block text-[11px] font-bold uppercase tracking-wide text-black/35">Condição</span><b>{CONDITION_LABELS[offer.condition]??offer.condition}</b></div>
              </div>

              {photoUrls[`${item.id}:${offer.offer_id}`]&&(
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`Foto da peça oferecida por ${offer.supplier_name}`} src={photoUrls[`${item.id}:${offer.offer_id}`]} className="mt-4 h-40 w-full rounded-2xl object-cover" />
              )}
              {offer.notes&&<p className="mt-4 rounded-xl border border-black/10 p-3 text-sm text-black/60">{offer.notes}</p>}
            </article>)}
          </div>
        </section>)}
      </div>

      {data.offer_count>0&&<div className="mt-6 rounded-3xl border border-black/10 bg-white p-5 text-sm text-black/55"><b className="text-black/75">Por enquanto, só compare.</b> O contato da loja continua protegido e será liberado somente depois que você escolher uma proposta.</div>}
    </section>
  </main>;
}
