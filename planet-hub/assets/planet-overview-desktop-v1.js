(() => {
  'use strict';

  const DESKTOP = window.matchMedia('(min-width: 821px)');
  const EXTRA_APIS = {
    acquisition: '/api/hub/planet/acquisition/lp-franquias?period=7d',
    expansion: '/api/hub/planet/leads',
    fiveStars: '/api/hub/planet/five-stars/evaluations',
  };

  let radarSnapshot = null;
  let extraSnapshot = null;
  let extraLoading = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const num = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value) || 0);
  const pct = (value) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`;
  const dueMeta = (item) => window.PMHRadarData?.dueMeta?.(item?.dueDate) || { label: item?.status || 'Em acompanhamento', bucket: 'none' };

  const fetchJson = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const loadExtras = async () => {
    if (extraSnapshot) return extraSnapshot;
    if (extraLoading) return extraLoading;
    extraLoading = Promise.allSettled([
      fetchJson(EXTRA_APIS.acquisition),
      fetchJson(EXTRA_APIS.expansion),
      fetchJson(EXTRA_APIS.fiveStars),
    ]).then(([acquisition, expansion, fiveStars]) => {
      extraSnapshot = {
        acquisition: acquisition.status === 'fulfilled' ? acquisition.value : null,
        expansion: expansion.status === 'fulfilled' ? expansion.value : null,
        fiveStars: fiveStars.status === 'fulfilled' ? fiveStars.value : null,
      };
      return extraSnapshot;
    }).finally(() => { extraLoading = null; });
    return extraLoading;
  };

  const latestByUnit = (evaluations) => {
    const map = new Map();
    [...evaluations]
      .sort((a, b) => String(b.cycle || '').localeCompare(String(a.cycle || '')) || String(b.evaluatedAt || '').localeCompare(String(a.evaluatedAt || '')))
      .forEach((item) => {
        const key = String(item.unit || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        if (key && !map.has(key)) map.set(key, item);
      });
    return [...map.values()];
  };

  const metricCard = ({ tone = '', eyebrow, value, label, destination }) => `
    <button type="button" class="aos-op-metric ${tone}" data-overview-destination="${esc(destination)}">
      <small>${esc(eyebrow)}</small><strong>${esc(value)}</strong><span>${esc(label)}</span>
    </button>`;

  const milestone = (item) => {
    const due = dueMeta(item);
    return `<button type="button" class="aos-op-milestone ${esc(due.bucket || '')}" data-overview-destination="${esc(item.action)}">
      <div><small>${esc(item.origin || 'Operação')}</small><strong>${esc(item.title || 'Item sem título')}</strong><span>${esc(item.context || item.status || 'Em acompanhamento')}</span></div>
      <time>${esc(due.label)}</time>
    </button>`;
  };

  const buildViewModel = (snapshot, extras) => {
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const marketing = items.filter((item) => ['demand', 'conteudos'].includes(item.action));
    const campaigns = items.filter((item) => item.action === 'calendario');
    const inaugurations = items.filter((item) => item.action === 'inauguracoes');
    const tickets = items.filter((item) => item.action === 'chamados');

    const lateTickets = tickets.filter((item) => dueMeta(item).bucket === 'late').length;
    const todayTickets = tickets.filter((item) => dueMeta(item).bucket === 'today').length;
    const nextCampaign = campaigns[0] || null;
    const nextOpening = inaugurations[0] || null;

    const acquisition = extras?.acquisition?.current || {};
    const funnelSteps = acquisition.funnel?.steps || [];
    const visitors = funnelSteps.find((step) => step.event === 'page_view')?.count || 0;
    const whatsapp = funnelSteps.find((step) => step.event === 'whatsapp_click')?.count || 0;
    const acquisitionConversion = visitors ? (whatsapp / visitors) * 100 : 0;

    const leads = Array.isArray(extras?.expansion?.data) ? extras.expansion.data : [];
    const newLeads = leads.filter((lead) => !lead.viewedAt || lead.status === 'new').length;
    const activeLeads = leads.filter((lead) => !['qualified', 'discarded'].includes(lead.status)).length;

    const evaluations = Array.isArray(extras?.fiveStars?.data) ? extras.fiveStars.data : [];
    const units = latestByUnit(evaluations);
    const p5Average = units.length ? units.reduce((sum, item) => sum + (Number(item.total) || 0), 0) / units.length : null;

    const milestones = [...campaigns, ...inaugurations, ...marketing]
      .filter((item) => item.dueDate)
      .sort((a, b) => (dueMeta(a).weight ?? 99999) - (dueMeta(b).weight ?? 99999))
      .slice(0, 6);

    return {
      metrics: [
        { eyebrow: 'MARKETING', value: String(marketing.length), label: marketing.length === 1 ? 'item em fluxo' : 'itens em fluxo', destination: 'marketing' },
        { eyebrow: 'CAMPANHAS', value: String(campaigns.length), label: nextCampaign ? `${nextCampaign.title} · ${dueMeta(nextCampaign).label}` : 'sem marco ativo', destination: 'calendario' },
        { eyebrow: 'INAUGURAÇÕES', value: String(inaugurations.length), label: nextOpening ? `${nextOpening.title} · ${dueMeta(nextOpening).label}` : 'nenhum projeto ativo', destination: 'inauguracoes' },
        { eyebrow: 'CHAMADOS', value: String(tickets.length), label: lateTickets ? `${lateTickets} atrasado${lateTickets === 1 ? '' : 's'}` : todayTickets ? `${todayTickets} vence${todayTickets === 1 ? '' : 'm'} hoje` : 'sem atraso crítico', destination: 'chamados', tone: lateTickets ? 'danger' : '' },
        { eyebrow: 'AQUISIÇÃO · 7D', value: num(visitors), label: visitors ? `${pct(acquisitionConversion)} até WhatsApp` : 'sem visitas medidas', destination: 'aquisicao' },
        { eyebrow: 'EXPANSÃO', value: String(activeLeads), label: newLeads ? `${newLeads} novo${newLeads === 1 ? '' : 's'} para olhar` : 'fila sem novos', destination: 'expansao', tone: newLeads ? 'attention' : '' },
        { eyebrow: '5 ESTRELAS', value: p5Average == null ? '—' : p5Average.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), label: units.length ? `média · ${units.length} unidade${units.length === 1 ? '' : 's'}` : 'aguardando avaliações', destination: '5-estrelas' },
      ],
      milestones,
      counts: { lateTickets, todayTickets, campaigns: campaigns.length, inaugurations: inaugurations.length, marketing: marketing.length, newLeads },
    };
  };

  const render = () => {
    if (!DESKTOP.matches) return;
    const root = document.querySelector('[data-planet-overview]');
    if (!root || !radarSnapshot) return;

    let cockpit = root.querySelector('[data-planet-desktop-cockpit]');
    if (!cockpit) {
      cockpit = document.createElement('section');
      cockpit.className = 'aos-planet-desktop-cockpit';
      cockpit.dataset.planetDesktopCockpit = '1';
      root.querySelector('.aos-planet-overview-intro')?.insertAdjacentElement('afterend', cockpit);
    }

    const model = buildViewModel(radarSnapshot, extraSnapshot);
    cockpit.innerHTML = `
      <section class="aos-op-summary">
        <header><div><small>PANORAMA REAL</small><h3>Operação em uma tela</h3></div><span>dados vivos das áreas</span></header>
        <div class="aos-op-metrics">${model.metrics.map(metricCard).join('')}</div>
      </section>
      <section class="aos-op-milestones-panel">
        <header><div><small>PRÓXIMOS MARCOS</small><h3>O que vem pela frente</h3></div><button type="button" data-overview-destination="radar">Abrir Radar</button></header>
        <div class="aos-op-milestones">${model.milestones.length
          ? model.milestones.map(milestone).join('')
          : '<div class="aos-op-empty">Nenhum marco com data encontrado na operação.</div>'}</div>
      </section>`;
  };

  const hydrate = async () => {
    if (!DESKTOP.matches || location.hash !== '#planet') return;
    if (window.PMHRadarData?.collect) {
      try { radarSnapshot = await window.PMHRadarData.collect({ maxAgeMs: 15000 }); } catch (_) { /* mantém leitura parcial */ }
    }
    render();
    await loadExtras();
    if (location.hash === '#planet') render();
  };

  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('[data-overview-destination]');
    if (!target) return;
    const destination = target.dataset.overviewDestination;
    const hash = {
      marketing: '#marketing', calendario: '#calendario', inauguracoes: '#inauguracoes', chamados: '#chamados',
      aquisicao: '#aquisicao', expansao: '#expansao', '5-estrelas': '#5-estrelas', radar: '#radar',
      demand: '#demandas', conteudos: '#conteudos',
    }[destination] || '#radar';
    location.hash = hash;
  });

  window.addEventListener('pmh:radar-data', (event) => {
    radarSnapshot = event.detail;
    render();
  });
  window.addEventListener('andre-os:home-page-rendered', (event) => {
    if (event.detail?.page === 'planet') hydrate();
  });
  window.addEventListener('hashchange', () => {
    if (location.hash === '#planet') hydrate();
  });
  DESKTOP.addEventListener?.('change', () => {
    if (DESKTOP.matches && location.hash === '#planet') hydrate();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hydrate, { once: true });
  else hydrate();
})();
