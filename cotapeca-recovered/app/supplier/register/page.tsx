'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Option = { id: string; name: string };

type FormState = {
  legal_name: string;
  trade_name: string;
  cnpj: string;
  responsible_name: string;
  email: string;
  phone_e164: string;
  whatsapp_e164: string;
  city: string;
  state: string;
  service_radius_km: string;
  accepts_shipping: boolean;
  all_brands: boolean;
  conditions: string[];
  brand_ids: string[];
  category_ids: string[];
  latitude?: number;
  longitude?: number;
};

const CONDITIONS = [
  ['new_original', 'Nova original'],
  ['new_aftermarket', 'Nova paralela'],
  ['used_original', 'Usada original'],
  ['reconditioned', 'Recondicionada'],
] as const;

const RADII = ['30', '60', '100'] as const;

const initialForm: FormState = {
  legal_name: '', trade_name: '', cnpj: '', responsible_name: '', email: '', phone_e164: '', whatsapp_e164: '', city: '', state: '', service_radius_km: '60', accepts_shipping: true, all_brands: true, conditions: ['new_original', 'new_aftermarket', 'used_original'], brand_ids: [], category_ids: [],
};

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}

export default function SupplierRegisterPage() {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(initialForm);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [message, setMessage] = useState('Carregando cadastro…');
  const [saving, setSaving] = useState(false);
  const [geoMessage, setGeoMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { location.href = '/auth/login?next=/supplier/opportunities'; return; }
      const { data: existing } = await supabase.from('suppliers').select('id,verification_status').maybeSingle();
      if (existing) { location.href = '/supplier/opportunities'; return; }
      const [{ data: brandRows }, { data: categoryRows }] = await Promise.all([
        supabase.from('vehicle_brands').select('id,name').eq('active', true).order('name'),
        supabase.from('piece_categories').select('id,name').eq('active', true).order('name'),
      ]);
      if (!active) return;
      setBrands((brandRows ?? []) as Option[]);
      setCategories((categoryRows ?? []) as Option[]);
      setForm((current) => ({ ...current, email: auth.user?.email ?? current.email }));
      setMessage('');
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  function useLocation() {
    if (!navigator.geolocation) { setGeoMessage('Localização não disponível neste navegador.'); return; }
    setGeoMessage('Buscando sua localização…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({ ...current, latitude: coords.latitude, longitude: coords.longitude }));
        setGeoMessage('Localização adicionada ao cadastro.');
      },
      () => setGeoMessage('Não foi possível obter a localização. Você pode continuar sem ela.'),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cnpj = form.cnpj.replace(/\D/g, '');
    const phone = normalizePhone(form.phone_e164);
    const whatsapp = normalizePhone(form.whatsapp_e164 || form.phone_e164);

    if (cnpj.length !== 14) { setMessage('Confira o CNPJ. Ele precisa ter 14 números.'); return; }
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || !/^\+[1-9]\d{7,14}$/.test(whatsapp)) { setMessage('Confira o telefone e o WhatsApp.'); return; }
    if (form.conditions.length === 0) { setMessage('Selecione ao menos uma condição de peça.'); return; }
    if (!form.all_brands && form.brand_ids.length === 0) { setMessage('Selecione as marcas atendidas ou marque Todas as marcas.'); return; }
    if (!RADII.includes(form.service_radius_km as (typeof RADII)[number])) { setMessage('Escolha um raio de atendimento válido.'); return; }

    setSaving(true); setMessage('');
    const payload = {
      ...form,
      cnpj,
      state: form.state.trim().toUpperCase(),
      service_radius_km: Number(form.service_radius_km),
      phone_e164: phone,
      whatsapp_e164: whatsapp,
    };
    const { error } = await supabase.rpc('register_supplier', { payload });
    if (error) { setMessage(error.message || 'Não foi possível concluir o cadastro.'); setSaving(false); return; }
    location.href = '/supplier/opportunities';
  }

  const input = 'min-h-12 w-full rounded-2xl border border-black/10 bg-white px-4 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10';
  const label = 'text-sm font-black text-black/75';

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-5 py-6 text-[#1d1d1f] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-[-.04em]">Cota<span className="text-orange-600">Peça</span></Link>
          <span className="text-xs font-bold uppercase tracking-[.16em] text-black/35">Cadastro fornecedor</span>
        </div>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-white ring-1 ring-black/[.06]">
          <div className="grid lg:grid-cols-[.72fr_1.28fr]">
            <aside className="bg-[#0b0b0c] p-7 text-white sm:p-9">
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-orange-400">Quero vender peças</p>
              <h1 className="mt-4 text-4xl font-black leading-[.95] tracking-[-.05em]">Cadastre sua loja.</h1>
              <p className="mt-5 text-sm leading-6 text-white/50">Depois da aprovação, pedidos compatíveis aparecem automaticamente no seu painel.</p>
              <div className="mt-8 space-y-3 text-sm font-semibold text-white/65">
                <p>✓ Você escolhe marcas e categorias</p>
                <p>✓ Define raio de atendimento</p>
                <p>✓ Pode aceitar envio</p>
                <p>✓ Seus dados de contato não aparecem ao comprador nesta etapa</p>
              </div>
            </aside>

            <form onSubmit={submit} className="grid gap-6 p-6 sm:p-8">
              {message ? <div className="rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">{message}</div> : null}

              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-4 text-xl font-black sm:col-span-2">Dados da loja</legend>
                <label className="grid gap-2"><span className={label}>Razão social</span><input className={input} required value={form.legal_name} onChange={(e)=>setForm({...form,legal_name:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>Nome da loja</span><input className={input} required value={form.trade_name} onChange={(e)=>setForm({...form,trade_name:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>CNPJ</span><input className={input} inputMode="numeric" required placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e)=>setForm({...form,cnpj:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>Responsável</span><input className={input} required value={form.responsible_name} onChange={(e)=>setForm({...form,responsible_name:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>E-mail</span><input className={input} type="email" required value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>Telefone</span><input className={input} inputMode="tel" required placeholder="(47) 99999-9999" value={form.phone_e164} onChange={(e)=>setForm({...form,phone_e164:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>WhatsApp</span><input className={input} inputMode="tel" placeholder="Se vazio, usa o telefone" value={form.whatsapp_e164} onChange={(e)=>setForm({...form,whatsapp_e164:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>Cidade</span><input className={input} required value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></label>
                <label className="grid gap-2"><span className={label}>UF</span><input className={input} required maxLength={2} placeholder="SC" value={form.state} onChange={(e)=>setForm({...form,state:e.target.value})}/></label>
                <label className="grid gap-2 sm:col-span-2"><span className={label}>Raio de atendimento</span><select className={input} required value={form.service_radius_km} onChange={(e)=>setForm({...form,service_radius_km:e.target.value})}>{RADII.map((radius)=><option key={radius} value={radius}>{radius} km</option>)}</select></label>
              </fieldset>

              <div className="rounded-2xl bg-[#f5f5f7] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-black">Localização da loja</p><p className="mt-1 text-xs text-black/45">Ajuda a distribuir pedidos por distância.</p></div>
                  <button type="button" onClick={useLocation} className="rounded-full bg-white px-4 py-2 text-sm font-black ring-1 ring-black/10">Usar minha localização</button>
                </div>
                {geoMessage ? <p className="mt-3 text-xs font-semibold text-black/50">{geoMessage}</p> : null}
              </div>

              <fieldset>
                <legend className="text-xl font-black">Condições que trabalha</legend>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {CONDITIONS.map(([value,text]) => <label key={value} className="flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 font-semibold"><input type="checkbox" checked={form.conditions.includes(value)} onChange={()=>setForm({...form,conditions:toggle(form.conditions,value)})}/>{text}</label>)}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xl font-black">Marcas</legend>
                <label className="mt-4 flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 font-black text-orange-800"><input type="checkbox" checked={form.all_brands} onChange={(e)=>setForm({...form,all_brands:e.target.checked})}/>Todas as marcas</label>
                {!form.all_brands ? <div className="mt-3 grid max-h-52 gap-2 overflow-auto rounded-2xl border border-black/10 p-3 sm:grid-cols-2">{brands.map((brand)=><label key={brand.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.brand_ids.includes(brand.id)} onChange={()=>setForm({...form,brand_ids:toggle(form.brand_ids,brand.id)})}/>{brand.name}</label>)}</div> : null}
              </fieldset>

              <fieldset>
                <legend className="text-xl font-black">Categorias</legend>
                <p className="mt-1 text-xs text-black/45">Marque as principais. Você pode ajustar depois.</p>
                <div className="mt-3 grid max-h-52 gap-2 overflow-auto rounded-2xl border border-black/10 p-3 sm:grid-cols-2">{categories.map((category)=><label key={category.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.category_ids.includes(category.id)} onChange={()=>setForm({...form,category_ids:toggle(form.category_ids,category.id)})}/>{category.name}</label>)}</div>
              </fieldset>

              <label className="flex items-start gap-3 rounded-2xl border border-black/10 px-4 py-3"><input className="mt-1" type="checkbox" checked={form.accepts_shipping} onChange={(e)=>setForm({...form,accepts_shipping:e.target.checked})}/><span><strong>Aceito enviar peças</strong><br/><span className="text-xs text-black/45">Permite receber oportunidades fora do raio quando o matching considerar envio.</span></span></label>

              <button disabled={saving || message === 'Carregando cadastro…'} className="min-h-13 rounded-2xl bg-[#1d1d1f] px-5 font-black text-white disabled:opacity-50">{saving ? 'SALVANDO…' : 'CONCLUIR CADASTRO →'}</button>
              <p className="text-center text-xs leading-5 text-black/40">O cadastro entra como pendente e precisa ser aprovado antes de receber oportunidades.</p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
