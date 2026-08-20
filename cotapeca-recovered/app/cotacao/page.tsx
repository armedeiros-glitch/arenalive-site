'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const CONDITIONS = [
  ['new_original', 'Nova original'],
  ['new_aftermarket', 'Nova paralela'],
  ['used_original', 'Usada original'],
  ['reconditioned', 'Recondicionada'],
] as const;

type Item = { id: string; piece_name: string; side: string; notes: string; files: File[] };
type Success = { quoteId: string; publicCode: string };

function uuid() {
  return crypto.randomUUID();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
  if (value.trim().startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return '';
}

function extensionFor(file: File) {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
}

export default function QuotePage() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<Success | null>(null);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [version, setVersion] = useState('');
  const [plate, setPlate] = useState('');
  const [items, setItems] = useState<Item[]>([{ id: uuid(), piece_name: '', side: '', notes: '', files: [] }]);
  const [conditions, setConditions] = useState<string[]>(['used_original']);
  const [city, setCity] = useState('Joinville');
  const [state, setState] = useState('SC');
  const [radius, setRadius] = useState('60');
  const [shipping, setShipping] = useState(true);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        location.href = '/auth/login?next=/cotacao';
        return;
      }
      setEmail(data.user.email ?? '');
      setReady(true);
    });
    return () => { active = false; };
  }, [supabase]);

  function toggleCondition(value: string) {
    setConditions((current) => current.includes(value) ? current.filter((x) => x !== value) : [...current, value]);
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function addItem() {
    if (items.length >= 25) return;
    setItems((current) => [...current, { id: uuid(), piece_name: '', side: '', notes: '', files: [] }]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function validateCurrentStep() {
    setError('');
    if (step === 1) {
      const yearNumber = Number(year);
      if (!brand.trim() || !model.trim() || !version.trim()) return 'Preencha marca, modelo e versão do veículo.';
      if (!Number.isInteger(yearNumber) || yearNumber < 1950 || yearNumber > new Date().getFullYear() + 1) return 'Confira o ano do veículo.';
    }
    if (step === 2) {
      if (items.some((item) => item.piece_name.trim().length < 2)) return 'Diga qual peça precisa em todos os itens.';
      if (items.some((item) => item.files.length > 3)) return 'Use no máximo 3 fotos por peça.';
      const invalidFile = items.flatMap((item) => item.files).find((file) => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024);
      if (invalidFile) return 'As fotos devem ser JPG, PNG ou WebP e ter até 6 MB.';
    }
    if (step === 3) {
      if (!city.trim() || state.length !== 2) return 'Informe sua cidade e estado.';
      if (conditions.length === 0) return 'Escolha pelo menos uma condição de peça.';
    }
    if (step === 4) {
      if (name.trim().length < 2) return 'Informe seu nome.';
      if (!normalizePhone(whatsapp)) return 'Informe um WhatsApp com DDD.';
    }
    return '';
  }

  function nextStep() {
    const message = validateCurrentStep();
    if (message) { setError(message); return; }
    setError('');
    setStep((current) => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    const message = validateCurrentStep();
    if (message) { setError(message); return; }
    setBusy(true);
    setError('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        location.href = '/auth/login?next=/cotacao';
        return;
      }

      const quoteId = uuid();
      const vehicleId = uuid();
      const draftId = uuid();
      const anonymousSessionId = uuid();
      const preparedItems: Array<Record<string, unknown>> = [];

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const photos: Array<Record<string, unknown>> = [];
        for (let photoIndex = 0; photoIndex < item.files.length; photoIndex += 1) {
          const file = item.files[photoIndex];
          const storageKey = `${user.id}/${quoteId}/${item.id}/${uuid()}.${extensionFor(file)}`;
          const { error: uploadError } = await supabase.storage.from('quote-photos').upload(storageKey, file, { contentType: file.type, upsert: false });
          if (uploadError) throw uploadError;
          photos.push({ storage_key: storageKey, mime_type: file.type, size_bytes: file.size, sort_order: photoIndex });
        }
        preparedItems.push({ id: item.id, piece_name: item.piece_name.trim(), side: item.side.trim(), notes: item.notes.trim(), sort_order: index, photos });
      }

      const payload = {
        quote_id: quoteId,
        vehicle_id: vehicleId,
        draft_id: draftId,
        anonymous_session_id: anonymousSessionId,
        buyer_name: name.trim(),
        whatsapp_e164: normalizePhone(whatsapp),
        email,
        vehicle: { brand_name: brand.trim(), model: model.trim(), year: Number(year), version: version.trim(), plate: plate.trim() },
        location: { city: city.trim(), state, radius_km: Number(radius), accepts_shipping: shipping },
        conditions,
        items: preparedItems,
      };

      const { data, error: submitError } = await supabase.rpc('submit_quote', { payload });
      if (submitError) throw submitError;
      const response = data as { quote_id?: string; public_code?: string } | null;
      setSuccess({ quoteId: response?.quote_id ?? quoteId, publicCode: response?.public_code ?? '' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível enviar a cotação. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="min-h-screen bg-[#f6f2e9] p-6 text-[#17191d]">Preparando sua cotação…</main>;

  if (success) {
    return (
      <main className="min-h-screen bg-[#f6f2e9] px-5 py-10 text-[#17191d]">
        <section className="mx-auto max-w-lg rounded-[2rem] border border-black/10 bg-white p-7 shadow-sm sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl">✓</div>
          <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-green-700">Pedido enviado</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Sua cotação já está rodando.</h1>
          <p className="mt-4 leading-7 text-black/55">O CotaPeça já pode distribuir o pedido para fornecedores compatíveis. Você não precisa repetir essas informações loja por loja.</p>
          {success.publicCode && <div className="mt-6 rounded-2xl bg-[#f6f2e9] p-4 text-sm"><span className="text-black/45">Código da cotação</span><br/><b className="text-lg">{success.publicCode}</b></div>}
          <Link href="/" className="mt-7 block rounded-2xl bg-[#17191d] px-5 py-4 text-center font-black text-white">VOLTAR AO INÍCIO</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f2e9] text-[#17191d]">
      <header className="border-b border-black/10 bg-white/80 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight">Cota<span className="text-orange-600">Peça</span></Link>
          <span className="text-xs font-black uppercase tracking-[.16em] text-black/40">Passo {step} de 4</span>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
        <div className="mb-8 flex gap-2">{[1,2,3,4].map((value) => <div key={value} className={`h-1.5 flex-1 rounded-full ${value <= step ? 'bg-orange-600' : 'bg-black/10'}`} />)}</div>

        {step === 1 && (
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-600">Seu veículo</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Qual carro precisa da peça?</h1>
            <p className="mt-3 text-black/55">A placa é opcional. Marca, modelo, ano e versão ajudam a evitar cotação errada.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Field label="Marca"><input value={brand} onChange={(e)=>setBrand(e.target.value)} placeholder="Ex.: Volkswagen" className="input" /></Field>
              <Field label="Modelo"><input value={model} onChange={(e)=>setModel(e.target.value)} placeholder="Ex.: Gol" className="input" /></Field>
              <Field label="Ano"><input value={year} onChange={(e)=>setYear(e.target.value)} inputMode="numeric" className="input" /></Field>
              <Field label="Versão"><input value={version} onChange={(e)=>setVersion(e.target.value)} placeholder="Ex.: 1.6 MSI" className="input" /></Field>
              <Field label="Placa (opcional)"><input value={plate} onChange={(e)=>setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" className="input" /></Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-600">Peças</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">O que você está procurando?</h1>
            <p className="mt-3 text-black/55">Pode adicionar mais de uma peça no mesmo pedido. Foto é opcional, mas ajuda bastante.</p>
            <div className="mt-7 grid gap-5">
              {items.map((item, index) => (
                <div key={item.id} className="rounded-[1.5rem] border border-black/10 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between"><b>Peça {index + 1}</b>{items.length > 1 && <button type="button" onClick={()=>removeItem(index)} className="text-sm font-bold text-red-600">Remover</button>}</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="Nome da peça"><input value={item.piece_name} onChange={(e)=>updateItem(index,{piece_name:e.target.value})} placeholder="Ex.: Farol dianteiro" className="input" /></Field>
                    <Field label="Lado (opcional)"><input value={item.side} onChange={(e)=>updateItem(index,{side:e.target.value})} placeholder="Ex.: esquerdo" className="input" /></Field>
                  </div>
                  <Field label="Observação (opcional)" className="mt-4"><textarea value={item.notes} onChange={(e)=>updateItem(index,{notes:e.target.value})} placeholder="Detalhes que ajudem a identificar a peça" className="input min-h-24 py-3" /></Field>
                  <Field label="Fotos (até 3)" className="mt-4"><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e)=>updateItem(index,{files:Array.from(e.target.files ?? []).slice(0,3)})} className="block w-full text-sm text-black/55 file:mr-3 file:rounded-xl file:border-0 file:bg-orange-50 file:px-4 file:py-2 file:font-bold file:text-orange-700" />{item.files.length > 0 && <span className="mt-2 block text-xs text-black/45">{item.files.length} foto(s) selecionada(s)</span>}</Field>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-4 rounded-2xl border border-black/15 bg-white px-5 py-3 text-sm font-black">+ ADICIONAR OUTRA PEÇA</button>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-600">Preferências</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Onde e em que condição?</h1>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Field label="Cidade"><input value={city} onChange={(e)=>setCity(e.target.value)} className="input" /></Field>
              <Field label="Estado"><select value={state} onChange={(e)=>setState(e.target.value)} className="input">{UFS.map((uf)=><option key={uf}>{uf}</option>)}</select></Field>
              <Field label="Raio de busca"><select value={radius} onChange={(e)=>setRadius(e.target.value)} className="input"><option value="30">30 km</option><option value="60">60 km</option><option value="100">100 km</option></select></Field>
            </div>
            <div className="mt-7"><p className="text-sm font-black">Condições aceitas</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{CONDITIONS.map(([value,label])=><label key={value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${conditions.includes(value)?'border-orange-300 bg-orange-50':'border-black/10 bg-white'}`}><input type="checkbox" checked={conditions.includes(value)} onChange={()=>toggleCondition(value)} /><span className="font-bold">{label}</span></label>)}</div></div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-black/10 bg-white p-4"><input type="checkbox" checked={shipping} onChange={(e)=>setShipping(e.target.checked)} className="mt-1" /><span><b>Aceito receber por envio</b><small className="mt-1 block text-black/50">Amplia a chance de encontrar a peça fora do raio local.</small></span></label>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-orange-600">Finalizar</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Só falta seu contato.</h1>
            <p className="mt-3 text-black/55">Seu telefone não é exibido aos fornecedores nesta etapa.</p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <Field label="Seu nome"><input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Como podemos te chamar?" className="input" /></Field>
              <Field label="WhatsApp"><input value={whatsapp} onChange={(e)=>setWhatsapp(e.target.value)} placeholder="(47) 99999-9999" inputMode="tel" className="input" /></Field>
            </div>
            <div className="mt-6 rounded-2xl bg-white p-5 text-sm leading-6 text-black/55"><b className="text-black">Resumo</b><br/>{brand} {model} {year} {version || '—'}<br/>{items.length} peça(s) · {city}/{state} · raio de {radius} km</div>
          </div>
        )}

        {error && <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</p>}

        <div className="mt-8 flex gap-3">
          {step > 1 && <button type="button" onClick={()=>{setError('');setStep(step-1);}} className="rounded-2xl border border-black/15 bg-white px-5 py-4 font-black">VOLTAR</button>}
          {step < 4 ? <button type="button" onClick={nextStep} className="flex-1 rounded-2xl bg-[#17191d] px-5 py-4 font-black text-white">CONTINUAR</button> : <button type="button" disabled={busy} onClick={submit} className="flex-1 rounded-2xl bg-orange-600 px-5 py-4 font-black text-white disabled:opacity-50">{busy?'ENVIANDO…':'ENVIAR COTAÇÃO'}</button>}
        </div>
      </section>
      <style jsx global>{`.input{width:100%;height:52px;border-radius:1rem;border:1px solid rgba(0,0,0,.14);background:#fff;padding:0 1rem;outline:none}.input:focus{border-color:#ea580c;box-shadow:0 0 0 2px rgba(234,88,12,.08)}`}</style>
    </main>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="mb-2 block text-sm font-black">{label}</span>{children}</label>;
}
