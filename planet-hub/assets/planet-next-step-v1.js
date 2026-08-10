(() => {
  'use strict';

  const DESKTOP = window.matchMedia('(min-width: 821px)');
  const ROUTES = new Map([
    ['marketing', 'marketing'],
    ['calendario', 'calendario'],
    ['inauguracoes', 'inauguracoes'],
    ['chamados', 'chamados'],
    ['aquisicao', 'aquisicao'],
    ['expansao', 'expansao'],
    ['5-estrelas', '5-estrelas'],
    ['cinco-estrelas', '5-estrelas'],
    ['5estrelas', '5-estrelas'],
  ]);

  const API = {
    acquisition: '/api/hub/planet/acquisition/lp-franquias?period=7d',
    expansion: '/api/hub/planet/leads',
    fiveStars: '/api/hub/planet/five-stars/action-plans',
  };

  let frame = 0;
  let requestId = 0;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const route = () => ROUTES.get(String(location.hash || '').replace(/^#/, '').toLowerCase()) || '';
  const content = () => document.querySelector('[data-content]');
  const due = (value) => window.PMHRadarData?.dueMeta?.(value) || { label: value || 'Sem prazo', bucket: 'none', weight: 99999 };
  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const fetchJson = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const radarActions = {
    marketing: new Set(['demand', 'conteudos']),
    calendario: new Set(['calendario']),
    inauguracoes: new Set(['inauguracoes']),
    chamados: new Set(['chamados']),
  };

  const radarStep = async (area) => {
    const actions = radarActions[area];
    if (!actions || !window.PMHRadarData?.collect) return null;
    const snapshot = await window.PMHRadarData.collect({ maxAgeMs: 15000 });
    const items = (Array.isArray(snapshot?.items) ? snapshot.items : []).filter((item) => actions.has(item.action));
    if (!items.length) return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhuma ação imediata registrada',
      meta: 'A área não possui item operacional ativo no Radar.',
      badge: 'Sem ação agora',
      tone: 'empty',
    };

    const explicit = items.find((item) => String(item.nextAction || '').trim());
    const suggested = items.find((item) => String(item.contextSuggestion?.nextAction || '').trim());
    const item = explicit || suggested || items[0];
    const nextAction = String(item.nextAction || item.contextSuggestion?.nextAction || '').trim();
    const dueInfo = due(item.followUpDate || item.dueDate);

    if (nextAction) {
      return {
        eyebrow: explicit ? 'PRÓXIMO PASSO' : 'PRÓXIMO PASSO · RADAR',
        title: nextAction,
        meta: [item.title, item.context, item.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
        badge: dueInfo.label,
        tone: dueInfo.bucket === 'late' ? 'late' : '',
      };
    }

    if (area === 'calendario' && item.context) {
      return {
        eyebrow: 'PRÓXIMO MARCO',
        title: item.context,
        meta: item.title,
        badge: dueInfo.label,
        tone: dueInfo.bucket === 'late' ? 'late' : '',
      };
    }

    return {
      eyebrow: 'PRIORIDADE AGORA',
      title: item.title || 'Item operacional',
      meta: [item.status, item.context, item.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
      badge: dueInfo.label,
      tone: dueInfo.bucket === 'late' ? 'late' : '',
    };
  };

  const acquisitionStep = async () => {
    const payload = await fetchJson(API.acquisition);
    const current = payload?.current || {};
    const steps = current.funnel?.steps || [];
    const visitors = Number(steps.find((step) => step.event === 'page_view')?.count || 0);
    const whatsapp = Number(steps.find((step) => step.event === 'whatsapp_click')?.count || 0);
    const conversion = visitors ? ((whatsapp / visitors) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0';
    return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhuma ação operacional registrada para Aquisição',
      meta: `${visitors.toLocaleString('pt-BR')} visita${visitors === 1 ? '' : 's'} em 7 dias · ${conversion}% chegaram ao WhatsApp`,
      badge: 'Leitura do funil',
      tone: 'empty',
    };
  };

  const expansionStep = async () => {
    const payload = await fetchJson(API.expansion);
    const leads = Array.isArray(payload?.data) ? payload.data : [];
    const news = leads.filter((lead) => !lead.viewedAt || lead.status === 'new');
    if (!news.length) return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhum lead novo aguardando revisão',
      meta: 'A fila de Expansão está sem novos candidatos para triagem.',
      badge: 'Fila revisada',
      tone: 'empty',
    };
    return {
      eyebrow: 'PRÓXIMO PASSO',
      title: `Revisar ${news.length} lead${news.length === 1 ? '' : 's'} novo${news.length === 1 ? '' : 's'}`,
      meta: 'Abrir a fila e qualificar os candidatos ainda não visualizados.',
      badge: `${news.length} novo${news.length === 1 ? '' : 's'}`,
      tone: '',
    };
  };

  const fiveStarsStep = async () => {
    const payload = await fetchJson(API.fiveStars);
    const plans = (Array.isArray(payload?.data) ? payload.data : []).filter((plan) => plan.status !== 'concluido');
    if (!plans.length) return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhum plano de ação aberto',
      meta: 'O Planet 5 Estrelas não possui correção pendente registrada.',
      badge: 'Sem ação agora',
      tone: 'empty',
    };
    plans.sort((a, b) => {
      const lateA = a.deadline && a.deadline < today() ? 0 : 1;
      const lateB = b.deadline && b.deadline < today() ? 0 : 1;
      if (lateA !== lateB) return lateA - lateB;
      return String(a.deadline || '9999-12-31').localeCompare(String(b.deadline || '9999-12-31'));
    });
    const plan = plans[0];
    const dueInfo = due(plan.deadline);
    return {
      eyebrow: 'PRÓXIMO PASSO',
      title: plan.title || 'Plano de ação sem título',
      meta: [plan.unit, plan.ownerArea && `Responsável: ${plan.ownerArea}`, plan.notes].filter(Boolean).join(' · '),
      badge: dueInfo.label,
      tone: dueInfo.bucket === 'late' ? 'late' : '',
    };
  };

  const stepFor = async (area) => {
    if (radarActions[area]) return radarStep(area);
    if (area === 'aquisicao') return acquisitionStep();
    if (area === 'expansao') return expansionStep();
    if (area === '5-estrelas') return fiveStarsStep();
    return null;
  };

  const mount = async () => {
    if (!DESKTOP.matches) return;
    const area = route();
    const target = content();
    if (!area || !target) return;

    const id = ++requestId;
    target.querySelector('[data-planet-next-step]')?.remove();

    const placeholder = document.createElement('section');
    placeholder.className = 'aos-planet-next-step';
    placeholder.dataset.planetNextStep = '1';
    placeholder.dataset.tone = 'empty';
    placeholder.innerHTML = '<div class="aos-planet-next-step-copy"><small>PRÓXIMO PASSO</small><strong>Lendo a operação…</strong><span>Buscando o próximo movimento registrado desta área.</span></div><span class="aos-planet-next-step-badge">Atualizando</span>';
    target.prepend(placeholder);

    try {
      const model = await stepFor(area);
      if (id !== requestId || !placeholder.isConnected || route() !== area) return;
      const data = model || {
        eyebrow: 'PRÓXIMO PASSO', title: 'Nenhuma ação imediata registrada', meta: 'Não há próximo movimento disponível para esta área.', badge: 'Sem ação agora', tone: 'empty',
      };
      placeholder.dataset.tone = data.tone || '';
      placeholder.innerHTML = `<div class="aos-planet-next-step-copy"><small>${esc(data.eyebrow)}</small><strong>${esc(data.title)}</strong><span>${esc(data.meta)}</span></div><span class="aos-planet-next-step-badge">${esc(data.badge)}</span>`;
    } catch (error) {
      if (id !== requestId || !placeholder.isConnected) return;
      placeholder.dataset.tone = 'empty';
      placeholder.innerHTML = `<div class="aos-planet-next-step-copy"><small>PRÓXIMO PASSO</small><strong>Não consegui ler esta área agora</strong><span>${esc(error.message)}</span></div><span class="aos-planet-next-step-badge">Tentar ao reabrir</span>`;
    }
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(mount));
  };

  window.addEventListener('hashchange', schedule);
  window.addEventListener('pmh:radar-data', () => {
    if (radarActions[route()]) schedule();
  });
  window.addEventListener('pmh:view-rendered', schedule);
  window.addEventListener('andre-os:home-page-rendered', schedule);
  DESKTOP.addEventListener?.('change', schedule);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
