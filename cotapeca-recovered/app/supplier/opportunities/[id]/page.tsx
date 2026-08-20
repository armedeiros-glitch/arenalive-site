'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CONDITION_LABELS, kmLabel } from '@/lib/sprint2/format';

type Opportunity = { id: string; quote_id: string; distance_km: number | null };
type Quote = { id: string; city: string; state: string; accepts_shipping: boolean; vehicle_id: string };
type Vehicle = { brand_name: string; model: string; year: number | string; version: string | null };
type QuoteItem = { id: string; piece_name: string; side: string | null; notes: string | null };
type QuoteCondition = { condition: string };
type PhotoRow = { storage_key: string };

type Detail = {
  opportunity: Opportunity;
  quote: Quote;
  vehicle: Vehicle;
  items: QuoteItem[];
  conditions: QuoteCondition[];
  photoUrls: Record<string, string>;
};

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState('Carregando…');

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        location.href = `/auth/login?next=/supplier/opportunities/${id}`;
        return;
      }

      const { error: viewError } = await supabase.rpc('view_opportunity', { p_opportunity_id: id });
      if (viewError) {
        if (active) setMessage('Oportunidade indisponível.');
        return;
      }

      const { data: opportunityData } = await supabase.from('opportunities').select('id,quote_id,distance_km').eq('id', id).single();
      if (!opportunityData) return;
      const opportunity = opportunityData as Opportunity;

      const { data: quoteData } = await supabase.from('quotes').select('id,city,state,accepts_shipping,vehicle_id').eq('id', opportunity.quote_id).single();
      if (!quoteData) return;
      const quote = quoteData as Quote;

      const [{ data: vehicleData }, { data: itemData }, { data: conditionData }] = await Promise.all([
        supabase.from('vehicles').select('brand_name,model,year,version').eq('id', quote.vehicle_id).single(),
        supabase.from('quote_items').select('id,piece_name,side,notes').eq('quote_id', quote.id).order('sort_order'),
        supabase.from('quote_conditions').select('condition').eq('quote_id', quote.id),
      ]);
      if (!vehicleData) return;

      const vehicle = vehicleData as Vehicle;
      const items = (itemData ?? []) as QuoteItem[];
      const conditions = (conditionData ?? []) as QuoteCondition[];
      const photoUrls: Record<string, string> = {};

      for (const item of items) {
        const { data: photoData } = await supabase.from('quote_item_photos').select('storage_key').eq('quote_item_id', item.id);
        for (const photo of (photoData ?? []) as PhotoRow[]) {
          const { data: signed } = await supabase.storage.from('quote-photos').createSignedUrl(photo.storage_key, 120);
          if (signed?.signedUrl) photoUrls[item.id] = signed.signedUrl;
        }
      }

      if (!active) return;
      setDetail({ opportunity, quote, vehicle, items, conditions, photoUrls });
      setMessage('');
    })();

    return () => {
      active = false;
    };
  }, [id, supabase]);

  async function decline() {
    const { error } = await supabase.rpc('decline_opportunity', { p_opportunity_id: id });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Oportunidade recusada.');
  }

  if (!detail) return <main className="min-h-screen bg-[#f6f2e9] p-6">{message}</main>;

  return (
    <main className="min-h-screen bg-[#f6f2e9] text-[#1b1d22]">
      <section className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/supplier/opportunities" className="text-sm font-bold text-black/50">← Oportunidades</Link>
        <div className="mt-5 rounded-[2rem] bg-white p-6 shadow-sm md:p-9">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Cotação recebida</p>
          <h1 className="mt-2 text-3xl font-black">{detail.vehicle.brand_name} {detail.vehicle.model} {detail.vehicle.year}</h1>
          <p className="mt-1 text-black/55">{detail.vehicle.version}</p>
          <div className="mt-6 grid gap-3 rounded-2xl bg-[#f6f2e9] p-4 text-sm md:grid-cols-3">
            <span>📍 {detail.quote.city}/{detail.quote.state}</span>
            <span>Raio: {kmLabel(detail.opportunity.distance_km)}</span>
            <span>{detail.quote.accepts_shipping ? 'Aceita envio' : 'Somente região'}</span>
          </div>
          <h2 className="mt-8 text-lg font-black">Peças solicitadas</h2>
          <div className="mt-3 grid gap-3">
            {detail.items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-black/10 p-4">
                <b>{item.piece_name}</b>
                {item.side && <span className="ml-2 text-sm text-black/50">· {item.side}</span>}
                {item.notes && <p className="mt-2 text-sm text-black/60">{item.notes}</p>}
                {detail.photoUrls[item.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img data-testid="quote-photo" alt="Foto enviada pelo comprador" src={detail.photoUrls[item.id]} className="mt-3 h-32 w-32 rounded-xl object-cover" />
                )}
              </div>
            ))}
          </div>
          <h2 className="mt-8 text-lg font-black">Condições aceitas</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.conditions.map((condition) => (
              <span key={condition.condition} className="rounded-full bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800">
                {CONDITION_LABELS[condition.condition] ?? condition.condition}
              </span>
            ))}
          </div>
          <div className="mt-9 grid gap-3 md:grid-cols-2">
            <button data-testid="have-part" onClick={() => setMessage('Proposta entra na Sprint 3. Nenhuma proposta foi criada.')} className="rounded-2xl bg-orange-600 px-5 py-4 font-black text-white">TENHO ESSA PEÇA</button>
            <button data-testid="decline" onClick={decline} className="rounded-2xl border border-black/15 px-5 py-4 font-black">NÃO TENHO</button>
          </div>
          {message && <p data-testid="action-message" className="mt-4 text-sm font-bold text-black/60">{message}</p>}
          <p data-testid="privacy-note" className="mt-7 border-t border-black/10 pt-5 text-xs text-black/45">Dados pessoais do comprador permanecem protegidos. Aqui aparece somente o necessário para cotar.</p>
        </div>
      </section>
    </main>
  );
}
