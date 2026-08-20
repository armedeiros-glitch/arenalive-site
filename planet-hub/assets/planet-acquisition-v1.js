(() => {
  'use strict';

  const ROUTES = new Set(['aquisicao', 'aquisição', 'lp-franquias']);
  const API = '/api/hub/planet/acquisition/lp-franquias';
  const LABELS = {
    page_view: 'Visitantes da LP',
    form_open: 'Abriram formulário',
    lead_step_1: 'Concluíram etapa 1',
    qualification_start: 'Iniciaram qualificação',
    lead_step_2: 'Concluíram etapa 2',
    whatsapp_click: 'Foram para o WhatsApp',
  };
  let period = '7d';
  let customFrom = '';
  let customTo = '';
  let frame = 0;
  let loading = false;
  let payload = null;
  let error = '';

  const hash = () => String(location.hash || '').replace(/^#/, '').toLowerCase();
  const active = () => ROUTES.has(hash()) || hash().includes('aquis');
  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const num = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value) || 0);
  const pct = (value) => `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(Number(value) || 0)}%`;
  const duration = (seconds) => {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
  };
  const delta = (current, previous, percentage = false) => {
    const a = Number(current) || 0;
    const b = Number(previous) || 0;
    if (!b) return '<span>sem base anterior</span>';
    const change = ((a - b) / b) * 100;
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : '';
    const sign = change > 0 ? '↑ ' : change < 0 ? '↓ ' : '';
    return `<span class="pa-delta ${cls}">${sign}${pct(Math.abs(change))} vs anterior${percentage ? '' : ''}</span>`;
  };

  const ensureStyles = () => {
    if (document.querySelector('link[data-pa-styles]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/planet-hub/assets/planet-acquisition-v1.css?v=20260807-1';
    link.dataset.paStyles = 'true';
    document.head.appendChild(link);
  };

  const apiUrl = () => {
    const params = new URLSearchParams({ period });
    if (period === 'custom') {
      params.set('from', customFrom);
      params.set('to', customTo);
    }
    return `${API}?${params.toString()}`;
  };

  const load = async () => {
    if (!active() || loading) return;
    loading = true;
    error = '';
    render();
    try {
      const response = await fetch(apiUrl(), { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const next = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(next.error || `Falha HTTP ${response.status}`);
      payload = next;
    } catch (cause) {
      payload = null;
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
      render();
    }
  };

  const kpi = (label, value, current, previous, formatter = num) => `
    <article class="pa-kpi"><small>${label}</small><strong>${formatter(value)}</strong>${delta(current, previous)}</article>`;

  const maxOf = (items, key) => Math.max(1, ...items.map((item) => Number(item[key]) || 0));
  const breakdown = (items, valueKey, empty = 'Sem dados neste período') => {
    if (!items?.length) return `<div class="pa-empty">${empty}</div>`;
    const max = maxOf(items, valueKey);
    return `<div class="pa-list">${items.slice(0, 8).map((item) => `
      <div class="pa-row"><div class="pa-row-label"><strong title="${esc(item.label)}">${esc(item.label)}</strong><span><i style="width:${Math.max(3, ((Number(item[valueKey]) || 0) / max) * 100)}%"></i></span></div><b>${num(item[valueKey])}</b></div>
    `).join('')}</div>`;
  };

  const funnelMarkup = (current, previous) => {
    const previousByEvent = Object.fromEntries((previous?.steps || []).map((step) => [step.event, step]));
    return `<div class="pa-funnel">${(current?.steps || []).map((step, index) => {
      const prev = previousByEvent[step.event]?.count || 0;
      return `<article class="pa-step">
        <div class="pa-step-main"><b class="pa-step-index">${String(index + 1).padStart(2, '0')}</b><span><strong>${LABELS[step.event] || esc(step.event)}</strong><small>${index === 0 ? 'base do funil' : `${pct(step.totalConversion)} do total de visitantes`}</small></span></div>
        <strong class="pa-step-count">${num(step.count)}</strong>
        <div class="pa-step-rates">${index === 0 ? '<b>100%</b>entrada' : `<b>${pct(step.previousConversion)}</b>da etapa anterior`}${delta(step.count, prev)}</div>
      </article>`;
    }).join('')}</div>`;
  };

  const campaignTable = (items) => {
    if (!items?.length) return '<div class="pa-empty">Nenhuma campanha UTM identificada.</div>';
    return `<table class="pa-table"><thead><tr><th>Campanha</th><th>Sessões</th><th>Usuários</th></tr></thead><tbody>${items.slice(0, 10).map((item) => `<tr><td>${esc(item.label)}</td><td>${num(item.sessions)}</td><td>${num(item.users)}</td></tr>`).join('')}</tbody></table>`;
  };

  const customControls = () => period === 'custom' ? `
    <span class="pa-custom"><input type="date" data-pa-from value="${esc(customFrom)}"><input type="date" data-pa-to value="${esc(customTo)}"><button type="button" data-pa-apply>Aplicar</button></span>` : '';

  const dashboard = () => {
    const current = payload?.current || {};
    const previous = payload?.previous || {};
    const summary = current.summary || {};
    const previousSummary = previous.summary || {};
    const steps = current.funnel?.steps || [];
    const visitors = steps[0]?.count || 0;
    const step1 = steps.find((step) => step.event === 'lead_step_1')?.count || 0;
    const step2 = steps.find((step) => step.event === 'lead_step_2')?.count || 0;
    const whatsapp = steps.find((step) => step.event === 'whatsapp_click')?.count || 0;
    const dateLabel = payload?.period ? `${payload.period.current.startDate} → ${payload.period.current.endDate}` : '';
    return `
      <div class="pa-status"><i></i><span>GA4 · /franquias/ · ${esc(dateLabel)} · atualização ${payload?.fetchedAt ? new Date(payload.fetchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span></div>
      <section class="pa-summary">
        ${kpi('USUÁRIOS', summary.users, summary.users, previousSummary.users)}
        ${kpi('SESSÕES', summary.sessions, summary.sessions, previousSummary.sessions)}
        ${kpi('VISUALIZAÇÕES', summary.views, summary.views, previousSummary.views)}
        ${kpi('ENGAJAMENTO', (summary.engagementRate || 0) * 100, (summary.engagementRate || 0) * 100, (previousSummary.engagementRate || 0) * 100, pct)}
        ${kpi('TEMPO MÉDIO', summary.averageEngagementSeconds, summary.averageEngagementSeconds, previousSummary.averageEngagementSeconds, duration)}
      </section>
      <section class="pa-grid">
        <article class="pa-card">
          <div class="pa-section-title"><div><small>FUNIL DA LP</small><h3>Da visita ao WhatsApp</h3></div><span>${num(visitors)} visitantes</span></div>
          ${funnelMarkup(current.funnel, previous.funnel)}
          <div class="pa-diagnostics"><span><small>POPUP DE QUALIFICAÇÃO</small><strong>${num(current.funnel?.diagnostics?.qualificationPopup)}</strong></span><span><small>GENERATE LEAD</small><strong>${num(current.funnel?.diagnostics?.generateLead)}</strong></span></div>
        </article>
        <aside class="pa-side">
          <article class="pa-card"><div class="pa-section-title"><div><small>CONVERSÃO TOTAL</small><h3>Eficiência da LP</h3></div></div>
            <div class="pa-list">
              <div class="pa-row"><div class="pa-row-label"><strong>Visitante → etapa 1</strong></div><b>${pct(visitors ? (step1 / visitors) * 100 : 0)}</b></div>
              <div class="pa-row"><div class="pa-row-label"><strong>Visitante → etapa 2</strong></div><b>${pct(visitors ? (step2 / visitors) * 100 : 0)}</b></div>
              <div class="pa-row"><div class="pa-row-label"><strong>Visitante → WhatsApp</strong></div><b>${pct(visitors ? (whatsapp / visitors) * 100 : 0)}</b></div>
            </div>
          </article>
          <article class="pa-card"><div class="pa-section-title"><div><small>DISPOSITIVOS</small><h3>Mobile x desktop</h3></div></div>${breakdown(current.devices, 'users')}</article>
          <article class="pa-card"><div class="pa-section-title"><div><small>ORIGEM / MÍDIA</small><h3>De onde chegam</h3></div></div>${breakdown(current.sources, 'sessions')}</article>
        </aside>
      </section>
      <section class="pa-card" style="margin-top:12px"><div class="pa-section-title"><div><small>CAMPANHAS UTM</small><h3>Desempenho por campanha</h3></div><span>sessões e usuários</span></div>${campaignTable(current.campaigns)}</section>`;
  };

  const pageMarkup = () => `
    <section class="pa-page" data-pa-page>
      <header class="pa-head"><div><small>AQUISIÇÃO · LP FRANQUIAS</small><h2>Captação e conversão</h2><p>Camada de leitura do GA4. Dados individuais continuam no RD Station.</p></div>
        <div class="pa-periods">
          <button type="button" data-pa-period="today">Hoje</button><button type="button" data-pa-period="7d">7 dias</button><button type="button" data-pa-period="30d">30 dias</button><button type="button" data-pa-period="custom">Período</button>${customControls()}<button type="button" class="pa-refresh" data-pa-refresh>↻</button>
        </div></header>
      <div data-pa-body>${loading ? '<div class="pa-loading">Consultando Google Analytics…</div>' : error ? `<div class="pa-status error"><i></i><span>${esc(error)}</span></div>` : payload ? dashboard() : '<div class="pa-loading">Preparando aquisição…</div>'}</div>
    </section>`;

  const syncPeriods = () => document.querySelectorAll('[data-pa-period]').forEach((button) => button.classList.toggle('active', button.dataset.paPeriod === period));

  const render = () => {
    if (!active()) return;
    ensureStyles();
    const target = content();
    if (!target) return;
    if (title()) title().textContent = 'Aquisição · LP Franquias';
    target.dataset.planetAcquisition = 'v1';
    target.innerHTML = pageMarkup();
    syncPeriods();
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('pmh:view-rendered', {
      detail: { view: 'aquisicao', page: 'lp-franquias', content: target, segmented: true, viewId: 'planet-acquisition:v1' },
    })));
  };

  const schedule = ({ reload = false } = {}) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!active()) return;
      render();
      if (reload || !payload) load();
    });
  };

  document.addEventListener('click', (event) => {
    const periodButton = event.target.closest?.('[data-pa-period]');
    if (periodButton) {
      period = periodButton.dataset.paPeriod || '7d';
      if (period === 'custom' && (!customFrom || !customTo)) {
        const today = new Date();
        const end = today.toISOString().slice(0, 10);
        const startDate = new Date(today.getTime() - (6 * 86400000));
        customFrom = startDate.toISOString().slice(0, 10);
        customTo = end;
        render();
        return;
      }
      schedule({ reload: true });
      return;
    }
    if (event.target.closest?.('[data-pa-refresh]')) return schedule({ reload: true });
    if (event.target.closest?.('[data-pa-apply]')) {
      customFrom = document.querySelector('[data-pa-from]')?.value || '';
      customTo = document.querySelector('[data-pa-to]')?.value || '';
      schedule({ reload: true });
    }
  });

  window.addEventListener('hashchange', () => schedule({ reload: true }));
  window.addEventListener('pmh:access-ready', () => schedule({ reload: true }));
  window.addEventListener('pmh:view-rendered', (event) => {
    if (event.detail?.view === 'aquisicao') return;
    if (active()) schedule();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => schedule({ reload: true }), { once: true });
  else schedule({ reload: true });
})();
