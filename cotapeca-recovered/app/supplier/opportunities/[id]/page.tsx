'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CONDITION_LABELS, kmLabel } from '@/lib/sprint2/format';

type Opportunity = { id: string; quote_id: string; supplier_id: string; distance_km: number | null };
type Quote = { id: string; city: string; state: string; accepts_shipping: boolean; vehicle_id: string };
type Vehicle = { brand_name: string; model: string; year: number | string; version: string | null };
type QuoteItem = { id: string; piece_name: string; side: string | null; notes: string | null };
type QuoteCondition = { condition: string };
type PhotoRow = { storage_key: string };
type OfferRow = { id: string };

type Detail = {
  opportunity: Opportunity;
  quote: Quote;
  vehicle: Vehicle;
  items: QuoteItem[];
  conditions: QuoteCondition[];
  photoUrls: Record<string, string>;
  existingOfferId: string | null;
};

type DraftItem = {
  selected: boolean;
  price: string;
  condition: string;
  brandName: string;
  availabilityDays: string;
  deliveryMethod: 'pickup' | 'shipping' | 'both';
  deliveryDays: string;
  warrantyDays: string;
  notes: string;
  photos: File[];
};

function moneyToCents(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function safeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').slice(-80);
}

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const supabase = useMemo(() => createClient(), []);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState('Carregando…');
  const [offerMode, setOfferMode] = useState(false);
  const [sending, setSending] = useState(false);
  const [offerNotes, setOfferNotes] = useState('');
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>({});

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

      const { data: opportunityData } = await supabase.from('opportunities').select('id,quote_id,supplier_id,distance_km').eq('id', id).single();
      if (!opportunityData) return;
      const opportunity = opportunityData as Opportunity;

      const { data: quoteData } = await supabase.from('quotes').select('id,city,state,accepts_shipping,vehicle_id').eq('id', opportunity.quote_id).single();
      if (!quoteData) return;
      const quote = quoteData as Quote;

      const [{ data: vehicleData }, { data: itemData }, { data: conditionData }, { data: existingOffer }] = await Promise.all([
        supabase.from('vehicles').select('brand_name,model,year,version').eq('id', quote.vehicle_id).single(),
        supabase.from('quote_items').select('id,piece_name,side,notes').eq('quote_id', quote.id).order('sort_order'),
        supabase.from('quote_conditions').select('condition').eq('quote_id', quote.id),
        supabase.from('offers').select('id').eq('opportunity_id', id).maybeSingle(),
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
      setDetail({ opportunity, quote, vehicle, items, conditions, photoUrls, existingOfferId: (existingOffer as OfferRow | null)?.id ?? null });
      const firstCondition = conditions[0]?.condition ?? '';
      setDrafts(Object.fromEntries(items.map((item) => [item.id, {
        selected: true,
        price: '',
        condition: firstCondition,
        brandName: '',
        availabilityDays: '0',
        deliveryMethod: 'pickup' as const,
        deliveryDays: '',
        warrantyDays: '',
        notes: '',
        photos: [],
      }])));
      setMessage('');
    })();

    return () => {
      active = false;
    };
  }, [id, supabase]);

  function patchDraft(itemId: string, patch: Partial<DraftItem>) {
    setDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
  }

  async function startOffer() {
    if (detail?.existingOfferId) {
      location.href = '/supplier/offers';
      return;
    }
    const { error } = await supabase.rpc('start_offer', { p_opportunity_id: id });
    if (error) {
      setMessage('Não foi possível iniciar a proposta agora.');
      return;
    }
    setOfferMode(true);
    setMessage('');
  }

  async function submitOffer() {
    if (!detail || sending) return;
    const selectedItems = detail.items.filter((item) => drafts[item.id]?.selected);
    if (!selectedItems.length) {
      setMessage('Selecione pelo menos uma peça para cotar.');
      return;
    }

    for (const item of selectedItems) {
      const draft = drafts[item.id];
      if (!draft || moneyToCents(draft.price) <= 0 || !draft.condition || !draft.brandName.trim()) {
        setMessage(`Complete preço, condição e marca em ${item.piece_name}.`);
        return;
      }
    }

    setSending(true);
    setMessage('Enviando proposta…');
    const uploaded: string[] = [];

    try {
      const payloadItems = [];
      for (const item of selectedItems) {
        const draft = drafts[item.id];
        const photoStorageKeys: string[] = [];
        for (const file of draft.photos.slice(0, 5)) {
          const key = `${detail.opportunity.supplier_id}/${id}/${item.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
          const { error: uploadError } = await supabase.storage.from('offer-photos').upload(key, file, { upsert: false });
          if (uploadError) throw uploadError;
          uploaded.push(key);
          photoStorageKeys.push(key);
        }

        payloadItems.push({
          quote_item_id: item.id,
          price_cents: moneyToCents(draft.price),
          condition: draft.condition,
          brand_name: draft.brandName.trim(),
          availability_days: Number(draft.availabilityDays || 0),
          delivery_method: draft.deliveryMethod,
          delivery_days: draft.deliveryDays,
          warranty_days: draft.warrantyDays,
          notes: draft.notes,
          photo_storage_keys: photoStorageKeys,
        });
      }

      const { error } = await supabase.rpc('create_offer', {
        payload: { opportunity_id: id, notes: offerNotes, items: payloadItems },
      });
      if (error) throw error;

      location.href = '/supplier/offers?created=1';
    } catch (error) {
      if (uploaded.length) await supabase.storage.from('offer-photos').remove(uploaded);
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar a proposta.');
      setSending(false);
    }
  }

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
        <div className="flex items-center justify-between gap-4">
          <Link href="/supplier/opportunities" className="text-sm font-bold text-black/50">← Oportunidades</Link>
          <Link href="/supplier/offers" className="text-sm font-black text-orange-600">Minhas propostas</Link>
        </div>
        <div className="mt-5 rounded-[2rem] bg-white p-6 shadow-sm md:p-9">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Cotação recebida</p>
          <h1 className="mt-2 text-3xl font-black">{detail.vehicle.brand_name} {detail.vehicle.model} {detail.vehicle.year}</h1>
          <p className="mt-1 text-black/55">{detail.vehicle.version}</p>
          <div className="mt-6 grid gap-3 rounded-2xl bg-[#f6f2e9] p-4 text-sm md:grid-cols-3">
            <span>📍 {detail.quote.city}/{detail.quote.state}</span>
            <span>Raio: {kmLabel(detail.opportunity.distance_km)}</span>
            <span>{detail.quote.accepts_shipping ? 'Aceita envio' : 'Somente região'}</span>
          </div>

          {!offerMode && (
            <>
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
                <button data-testid="have-part" onClick={startOffer} className="rounded-2xl bg-orange-600 px-5 py-4 font-black text-white">
                  {detail.existingOfferId ? 'VER MINHA PROPOSTA' : 'TENHO ESSA PEÇA'}
                </button>
                {!detail.existingOfferId && <button data-testid="decline" onClick={decline} className="rounded-2xl border border-black/15 px-5 py-4 font-black">NÃO TENHO</button>}
              </div>
            </>
          )}

          {offerMode && (
            <div className="mt-8">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Sua proposta</p>
                <h2 className="mt-1 text-2xl font-black">Cotação rápida</h2>
                <p className="mt-1 text-sm text-black/55">Pode responder só o que você tem. Desmarque as peças que não vai cotar.</p>
              </div>

              <div className="grid gap-5">
                {detail.items.map((item) => {
                  const draft = drafts[item.id];
                  if (!draft) return null;
                  return (
                    <div key={item.id} className={`rounded-2xl border p-4 ${draft.selected ? 'border-orange-200 bg-orange-50/30' : 'border-black/10 opacity-60'}`}>
                      <label className="flex cursor-pointer items-center gap-3 font-black">
                        <input type="checkbox" checked={draft.selected} onChange={(e) => patchDraft(item.id, { selected: e.target.checked })} className="h-5 w-5 accent-orange-600" />
                        <span>{item.piece_name}{item.side ? ` · ${item.side}` : ''}</span>
                      </label>

                      {draft.selected && (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <label className="text-sm font-bold">Preço
                            <input data-testid={`offer-price-${item.id}`} value={draft.price} onChange={(e) => patchDraft(item.id, { price: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none focus:border-orange-400" />
                          </label>
                          <label className="text-sm font-bold">Condição
                            <select value={draft.condition} onChange={(e) => patchDraft(item.id, { condition: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none">
                              {detail.conditions.map((condition) => <option key={condition.condition} value={condition.condition}>{CONDITION_LABELS[condition.condition] ?? condition.condition}</option>)}
                            </select>
                          </label>
                          <label className="text-sm font-bold">Marca da peça
                            <input value={draft.brandName} onChange={(e) => patchDraft(item.id, { brandName: e.target.value })} placeholder="Ex.: Valeo" className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none" />
                          </label>
                          <label className="text-sm font-bold">Disponibilidade
                            <select value={draft.availabilityDays} onChange={(e) => patchDraft(item.id, { availabilityDays: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none">
                              <option value="0">Pronta entrega</option>
                              <option value="1">Em 1 dia</option>
                              <option value="2">Em 2 dias</option>
                              <option value="3">Em 3 dias</option>
                              <option value="5">Em até 5 dias</option>
                              <option value="7">Em até 7 dias</option>
                            </select>
                          </label>
                          <label className="text-sm font-bold">Entrega
                            <select value={draft.deliveryMethod} onChange={(e) => patchDraft(item.id, { deliveryMethod: e.target.value as DraftItem['deliveryMethod'] })} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none">
                              <option value="pickup">Retirada</option>
                              {detail.quote.accepts_shipping && <option value="shipping">Envio</option>}
                              {detail.quote.accepts_shipping && <option value="both">Retirada ou envio</option>}
                            </select>
                          </label>
                          {draft.deliveryMethod !== 'pickup' && <label className="text-sm font-bold">Prazo de entrega (dias)
                            <input type="number" min="0" max="365" value={draft.deliveryDays} onChange={(e) => patchDraft(item.id, { deliveryDays: e.target.value })} className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none" />
                          </label>}
                          <label className="text-sm font-bold">Garantia (dias)
                            <input type="number" min="0" max="3650" value={draft.warrantyDays} onChange={(e) => patchDraft(item.id, { warrantyDays: e.target.value })} placeholder="Opcional" className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none" />
                          </label>
                          <label className="text-sm font-bold md:col-span-2">Foto da peça
                            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => patchDraft(item.id, { photos: Array.from(e.target.files ?? []).slice(0, 5) })} className="mt-1 block w-full rounded-xl border border-dashed border-black/15 bg-white px-4 py-3 text-sm font-normal" />
                            <span className="mt-1 block text-xs font-normal text-black/45">Até 5 fotos. JPG, PNG ou WebP.</span>
                          </label>
                          <label className="text-sm font-bold md:col-span-2">Observação da peça
                            <textarea value={draft.notes} onChange={(e) => patchDraft(item.id, { notes: e.target.value })} rows={2} placeholder="Opcional" className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none" />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="mt-5 block text-sm font-bold">Observação geral
                <textarea value={offerNotes} onChange={(e) => setOfferNotes(e.target.value)} rows={2} placeholder="Opcional" className="mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 font-normal outline-none" />
              </label>

              <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
                <button data-testid="submit-offer" disabled={sending} onClick={submitOffer} className="rounded-2xl bg-orange-600 px-5 py-4 font-black text-white disabled:opacity-50">{sending ? 'ENVIANDO…' : 'ENVIAR PROPOSTA'}</button>
                <button disabled={sending} onClick={() => setOfferMode(false)} className="rounded-2xl border border-black/15 px-5 py-4 font-black">CANCELAR</button>
              </div>
            </div>
          )}

          {message && <p data-testid="action-message" className="mt-4 text-sm font-bold text-black/60">{message}</p>}
          <p data-testid="privacy-note" className="mt-7 border-t border-black/10 pt-5 text-xs text-black/45">Dados pessoais do comprador permanecem protegidos. Aqui aparece somente o necessário para cotar.</p>
        </div>
      </section>
    </main>
  );
}
