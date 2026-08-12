(() => {
  'use strict';

  const DESKTOP = window.matchMedia('(min-width: 821px)');
  const EXTRA_APIS = {
    acquisition: '/api/hub/planet/acquisition/lp-franquias?period=7d',
    expansion: '/api/hub/planet/leads',
    fiveStars: '/api/hub/planet/five-stars/evaluations',
    campaigns: '/api/hub/campanhas',
  };
  const CAMPAIGN_LOCAL_KEY = 'planet-hub-campaign-operations-v1';
  const RADAR_SOURCES = ['tickets', 'inaugurations', 'demands', 'contents', 'campaigns'];
  const BASE_CAMPAIGNS_2026 = [
    ['2026-02-14', 'Valentine’s Day', 'apoio'],
    ['2026-02-24', 'Aniversário Planet', 'principal'],
    ['2026-03-15', 'Dia do Consumidor', 'data'],
    ['2026-03-20', 'Dia da Felicidade', 'data'],
    ['2026-03-28', 'Hora do Planeta', 'data'],
    ['2026-04-05', 'Páscoa Planet', 'principal'],
    ['2026-04-14', 'Café', 'data'],
    ['2026-05-10', 'Dia das Mães', 'apoio'],
    ['2026-06-12', 'Dia dos Namorados', 'apoio'],
    ['2026-07-07', 'Dia Mundial do Chocolate', 'apoio'],
    ['2026-07-20', 'Dia do Amigo', 'data'],
    ['2026-08-09', 'Mês dos Pais Planet', 'principal'],
    ['2026-08-11', 'Dia do Estudante', 'data'],
    ['2026-09-15', 'Dia do Cliente', 'data'],
    ['2026-09-21', 'Dia da Árvore', 'data'],
    ['2026-09-22', 'Primavera Planet', 'principal'],
    ['2026-09-23', 'Dia do Sorvete', 'apoio'],
    ['2026-10-01', 'Dia Internacional do Café', 'data'],
    ['2026-10-01', 'Semana das Crianças', 'principal'],
    ['2026-10-31', 'Halloween Planet', 'principal'],
    ['2026-11-27', 'Black Planet', 'principal'],
    ['2026-12-25', 'Natal Planet', 'principal'],
    ['2026-12-31', 'Réveillon', 'data'],
  ];

  let radarSnapshot = null;
  let extraSnapshot = null;
  let extraLoading = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const num = (value) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(value) || 0);
  const pct = (value) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(value) || 0)}%`;
  const dueMeta = (item) => window.PMHRadarData?.dueMeta?.(item?.dueDate) || { label: item?.status || 'Em acompanhamento', bucket: 'none', weight: 99999 };
  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10)) ? String(value).slice(0, 10) : '';
  const normalize = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const campaignStart = (id) => cleanDate(String(id || '').split('__')[0] || '');
  const campaignName = (id) => {
    const slug = String(id || '').split('__')[1] || 'campanha';
    return slug.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };
  const campaignId = (date, name) => `${date}__${normalize(name)}`;

  const fetchJson = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const readLocalCampaigns = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CAMPAIGN_LOCAL_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const loadExtras = async ({ force = false } = {}) => {
    if (extraSnapshot && !force) return extraSnapshot;
    if (extraLoading && !force) return extraLoading;
    extraLoading = Promise.allSettled([
      fetchJson(EXTRA_APIS.acquisition),
      fetchJson(EXTRA_APIS.expansion),
      fetchJson(EXTRA_APIS.fiveStars),
      fetchJson(EXTRA_APIS.campaigns),
    ]).then(([acquisition, expansion, fiveStars, campaigns]) => {
      const remoteCampaigns = campaigns.status === 'fulfilled' && Array.isArray(campaigns.value?.data)
        ? campaigns.value.data
        : [];
      const localCampaigns = readLocalCampaigns();
      extraSnapshot = {
        acquisition: acquisition.status === 'fulfilled' ? acquisition.value : null,
        expansion: expansion.status === 'fulfilled' ? expansion.value : null,
        fiveStars: fiveStars.status === 'fulfilled' ? fiveStars.value : null,
        campaigns: remoteCampaigns.length ? remoteCampaigns : localCampaigns,
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

  const operationCampaignItems = (operations) => (Array.isArray(operations) ? operations : [])
    .filter((item) => item?.id && item.status !== 'concluida')
    .map((item) => ({
      id: String(item.id),
      origin: 'Campanha · Marco',
      title: campaignName(item.id),
      context: item.nextMilestone || 'Início da campanha',
      status: item.status || 'Planejamento',
      dueDate: cleanDate(item.milestoneDate) || campaignStart(item.id),
      action: 'calendario',
      priority: item.status === 'ativa' ? 0 : item.status === 'aprovacao' ? 1 : 2,
      operational: Boolean(item.nextMilestone || item.milestoneDate || item.responsible),
    }));

  const baseCampaignItems = () => BASE_CAMPAIGNS_2026.map(([date, name, type]) => ({
    id: campaignId(date, name),
    origin: 'Campanha',
    title: name,
    context: type === 'principal' ? 'Campanha principal da rede' : type === 'apoio' ? 'Campanha de apoio' : 'Data de conteúdo e relacionamento',
    status: 'Calendário 2026',
    dueDate: date,
    action: 'calendario',
    priority: type === 'principal' ? 1 : type === 'apoio' ? 2 : 3,
    operational: false,
  }));

  const mergedCampaignItems = (operations) => {
    const base = new Map(baseCampaignItems().map((item) => [item.id, item]));
    operationCampaignItems(operations).forEach((operation) => {
      const current = base.get(operation.id);
      base.set(operation.id, current ? {
        ...current,
        ...operation,
        title: current.title || operation.title,
        context: operation.context || current.context,
        dueDate: operation.dueDate || current.dueDate,
      } : operation);
    });
    return [...base.values()];
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

  const isUpcoming = (item, horizon = 30) => {
    if (!item?.dueDate) return false;
    const weight = Number(dueMeta(item).weight);
    return Number.isFinite(weight) && weight >= 0 && weight <= horizon;
  };

  const sortUpcoming = (a, b) => dueMeta(a).weight - dueMeta(b).weight || Number(a.priority ?? 3) - Number(b.priority ?? 3);

  const buildViewModel = (snapshot, extras) => {
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const marketing = items.filter((item) => ['demand', 'conteudos'].includes(item.action));
    const contentDeliveries = items.filter((item) => item.action === 'conteudos');
    const radarCampaigns = items.filter((item) => item.action === 'calendario');
    const directCampaigns = mergedCampaignItems(extras?.campaigns);
    const campaigns = directCampaigns.length ? directCampaigns : radarCampaigns;
    const inaugurations = items.filter((item) => item.action === 'inauguracoes');
    const tickets = items.filter((item) => item.action === 'chamados');

    const lateTickets = tickets.filter((item) => dueMeta(item).bucket === 'late').length;
    const todayTickets = tickets.filter((item) => dueMeta(item).bucket === 'today').length;
    const upcomingCampaigns = campaigns.filter((item) => dueMeta(item).weight >= 0).sort(sortUpcoming);
    const upcomingOperationalCampaigns = upcomingCampaigns.filter((item) => item.operational);
    const nextCampaign = upcomingOperationalCampaigns[0] || upcomingCampaigns[0] || null;
    const nextOpening = [...inaugurations]
      .filter((item) => dueMeta(item).weight >= 0)
      .sort((a, b) => dueMeta(a).weight - dueMeta(b).weight)[0] || inaugurations[0] || null;

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

    const milestones = [...campaigns, ...inaugurations, ...contentDeliveries]
      .filter((item) => isUpcoming(item, 30))
      .sort(sortUpcoming)
      .slice(0, 9);

    const campaignMetricLabel = nextCampaign
      ? `${nextCampaign.operational ? nextCampaign.context : nextCampaign.title} · ${dueMeta(nextCampaign).label}`
      : 'sem próxima data';

    return {
      metrics: [
        { eyebrow: 'MARKETING', value: String(marketing.length), label: marketing.length === 1 ? 'item em fluxo' : 'itens em fluxo', destination: 'marketing' },
        { eyebrow: 'CAMPANHAS', value: String(upcomingCampaigns.length), label: campaignMetricLabel, destination: 'calendario' },
        { eyebrow: 'INAUGURAÇÕES', value: String(inaugurations.length), label: nextOpening ? `${nextOpening.title} · ${dueMeta(nextOpening).label}` : 'nenhum projeto ativo', destination: 'inauguracoes' },
        { eyebrow: 'CHAMADOS', value: String(tickets.length), label: lateTickets ? `${lateTickets} atrasado${lateTickets === 1 ? '' : 's'}` : todayTickets ? `${todayTickets} vence${todayTickets === 1 ? '' : 'm'} hoje` : 'sem atraso crítico', destination: 'chamados', tone: lateTickets ? 'danger' : '' },
        { eyebrow: 'AQUISIÇÃO · 7D', value: num(visitors), label: visitors ? `${pct(acquisitionConversion)} até WhatsApp` : 'sem visitas medidas', destination: 'aquisicao' },
        { eyebrow: 'EXPANSÃO', value: String(activeLeads), label: newLeads ? `${newLeads} novo${newLeads === 1 ? '' : 's'} para olhar` : 'fila sem novos', destination: 'expansao', tone: newLeads ? 'attention' : '' },
        { eyebrow: '5 ESTRELAS', value: p5Average == null ? '—' : p5Average.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), label: units.length ? `média · ${units.length} unidade${units.length === 1 ? '' : 's'}` : 'aguardando avaliações', destination: '5-estrelas' },
      ],
      milestones,
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
        <header><div><small>AGENDA DA OPERAÇÃO · 30 DIAS</small><h3>O que vem pela frente</h3></div><button type="button" data-overview-destination="radar">Abrir Radar</button></header>
        <div class="aos-op-milestones">${model.milestones.length
          ? model.milestones.map(milestone).join('')
          : '<div class="aos-op-empty">Nenhuma campanha, inauguração ou entrega de conteúdo com data nos próximos 30 dias.</div>'}</div>
      </section>`;
  };

  const hydrate = async () => {
    if (!DESKTOP.matches || location.hash !== '#planet') return;
    if (window.PMHRadarData?.collect) {
      try { radarSnapshot = await window.PMHRadarData.collect({ sources: RADAR_SOURCES, maxAgeMs: 15000 }); } catch (_) { /* mantém leitura parcial */ }
    }
    render();
    await loadExtras({ force: true });
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