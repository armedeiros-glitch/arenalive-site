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
    ['conteudos', 'conteudos'],
    ['central', 'conteudos'],
  ]);

  const API = {
    acquisition: '/api/hub/planet/acquisition/lp-franquias?period=7d',
    expansion: '/api/hub/planet/leads',
    fiveStars: '/api/hub/planet/five-stars/action-plans',
    inaugurations: '/api/hub/inauguracoes',
    contents: '/api/hub/conteudos',
  };

  const P5_AREA_LABELS = {
    marketing: 'Marketing',
    campanhas: 'Campanhas',
    chamados: 'Chamados',
    unidade: 'Unidade / Franqueado',
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
    marketing: new Set(['demand']),
    calendario: new Set(['calendario']),
    inauguracoes: new Set(['inauguracoes']),
    chamados: new Set(['chamados']),
  };

  const collectRadarItems = async (area) => {
    const actions = radarActions[area];
    if (!actions || !window.PMHRadarData?.collect) return [];
    const snapshot = await window.PMHRadarData.collect({ maxAgeMs: 15000 });
    return (Array.isArray(snapshot?.items) ? snapshot.items : []).filter((item) => actions.has(item.action));
  };

  const actionModelForItem = (items) => {
    const explicit = items.find((item) => String(item.nextAction || '').trim());
    const suggested = items.find((item) => String(item.contextSuggestion?.nextAction || '').trim());
    const item = explicit || suggested;
    if (!item) return null;
    const nextAction = String(item.nextAction || item.contextSuggestion?.nextAction || '').trim();
    const dueInfo = due(item.followUpDate || item.dueDate);
    return {
      eyebrow: explicit ? 'PRÓXIMO PASSO' : 'PRÓXIMO PASSO · RADAR',
      title: nextAction,
      meta: [item.title, item.context, item.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
      badge: dueInfo.label,
      tone: dueInfo.bucket === 'late' ? 'late' : '',
    };
  };

  const radarStep = async (area) => {
    const items = await collectRadarItems(area);
    if (!items.length) return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhuma ação imediata registrada',
      meta: 'A área não possui item operacional ativo no Radar.',
      badge: 'Sem ação agora',
      tone: 'empty',
    };

    const action = actionModelForItem(items);
    if (action) return action;

    const item = items[0];
    const dueInfo = due(item.followUpDate || item.dueDate);
    return {
      eyebrow: 'PRIORIDADE AGORA',
      title: item.title || 'Item operacional',
      meta: [item.status, item.context, item.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
      badge: dueInfo.label,
      tone: dueInfo.bucket === 'late' ? 'late' : '',
    };
  };

  const marketingStep = async () => {
    const items = await collectRadarItems('marketing');
    if (!items.length) return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhuma demanda ativa no Marketing',
      meta: 'O fluxo criativo não possui demanda interna aberta agora.',
      badge: 'Sem ação agora',
      tone: 'empty',
    };

    const action = actionModelForItem(items);
    if (action) return action;

    const item = items[0];
    const dueInfo = due(item.followUpDate || item.dueDate);
    return {
      eyebrow: 'PRÓXIMO PASSO · MARKETING',
      title: `Definir o próximo passo de ${item.title || 'demanda sem título'}`,
      meta: [item.status, item.context, item.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
      badge: dueInfo.label,
      tone: dueInfo.bucket === 'late' ? 'late' : '',
    };
  };

  const campaignStep = async () => {
    const items = await collectRadarItems('calendario');
    const action = actionModelForItem(items);
    if (action) return action;

    const focusCards = [...document.querySelectorAll('.pmh-campaign-focus-card[data-edit-campaign]')];
    const card = focusCards.find((entry) => /próxima campanha/i.test(entry.querySelector(':scope > small')?.textContent || ''))
      || focusCards[0]
      || null;

    if (card) {
      const id = String(card.dataset.editCampaign || '');
      const title = card.querySelector('h3')?.textContent?.trim() || 'Próxima campanha';
      const role = card.querySelector(':scope > small')?.textContent?.trim() || 'Campanha';
      const timing = card.querySelector('footer b')?.textContent?.trim() || '';
      const ownerText = card.querySelector(':scope > em')?.textContent?.trim() || '';
      const sameCampaign = id ? [...document.querySelectorAll('[data-edit-campaign]')].filter((entry) => entry.dataset.editCampaign === id) : [];
      const milestoneNode = sameCampaign.map((entry) => entry.querySelector('.pmh-campaign-next-step strong')).find(Boolean);
      const milestoneDateNode = sameCampaign.map((entry) => entry.querySelector('.pmh-campaign-next-step span')).find(Boolean);
      const milestone = milestoneNode?.textContent?.trim() || '';
      const milestoneDate = milestoneDateNode?.textContent?.trim() || '';

      if (milestone && !/ainda não definido/i.test(milestone)) {
        return {
          eyebrow: 'PRÓXIMO PASSO · CAMPANHA',
          title: milestone,
          meta: [title, ownerText].filter(Boolean).join(' · '),
          badge: milestoneDate || timing || role,
          tone: '',
        };
      }

      if (/ainda não definido|sem responsável/i.test(ownerText)) {
        return {
          eyebrow: 'PRÓXIMO PASSO · CAMPANHA',
          title: `Definir responsável para ${title}`,
          meta: [role, timing, 'Depois, registrar o próximo marco operacional'].filter(Boolean).join(' · '),
          badge: timing || 'Planejamento',
          tone: '',
        };
      }

      return {
        eyebrow: 'PRÓXIMO PASSO · CAMPANHA',
        title: `Definir o próximo marco de ${title}`,
        meta: [ownerText, timing].filter(Boolean).join(' · '),
        badge: timing || 'Planejamento',
        tone: '',
      };
    }

    if (items.length) {
      const item = items[0];
      const dueInfo = due(item.followUpDate || item.dueDate);
      return {
        eyebrow: 'PRÓXIMO MARCO',
        title: item.context || item.title || 'Campanha em acompanhamento',
        meta: item.title || 'Calendário de campanhas',
        badge: dueInfo.label,
        tone: dueInfo.bucket === 'late' ? 'late' : '',
      };
    }

    return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhuma campanha operacional encontrada',
      meta: 'Abra o calendário para revisar o próximo período.',
      badge: 'Sem ação agora',
      tone: 'empty',
    };
  };

  const cleanStepTitle = (step) => String(step?.label || step?.title || step?.name || step?.task || '').trim();
  const stepDueDate = (step) => String(step?.dueDate || step?.deadline || step?.date || '').slice(0, 10);
  const stepIsDone = (step) => Boolean(step?.done || step?.completed || step?.status === 'concluido' || step?.status === 'done');
  const stepIsLate = (step) => {
    const date = stepDueDate(step);
    return !stepIsDone(step) && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today();
  };

  const domChecklistStep = (unit) => {
    const cards = [...document.querySelectorAll('.pmh-inauguration-card')];
    const normalizedUnit = String(unit || '').toLowerCase().trim();
    const card = cards.find((entry) => String(entry.querySelector(':scope > header h3')?.textContent || '').toLowerCase().trim() === normalizedUnit)
      || cards[0]
      || null;
    if (!card) return null;

    const pending = [...card.querySelectorAll('.pmh-checklist label')].filter((label) => !label.classList.contains('done'));
    if (!pending.length) return null;
    const late = pending.find((label) => {
      if (/late|overdue|atras/i.test(label.className)) return true;
      const text = label.textContent || '';
      const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return false;
      return `${match[3]}-${match[2]}-${match[1]}` < today();
    });
    const target = late || pending[0];
    const title = target.querySelector('strong')?.textContent?.trim()
      || target.querySelector('span')?.textContent?.trim()
      || target.textContent?.replace(/\s+/g, ' ').trim()
      || '';
    return title ? { title, late: Boolean(late) } : null;
  };

  const apiChecklistStep = async (unit) => {
    try {
      const payload = await fetchJson(API.inaugurations);
      const projects = Array.isArray(payload?.data) ? payload.data : [];
      const normalizedUnit = String(unit || '').toLowerCase().trim();
      const project = projects.find((entry) => String(entry.unit || '').toLowerCase().trim() === normalizedUnit) || projects[0] || null;
      if (!project) return null;
      const checklist = Array.isArray(project.checklist) ? project.checklist.filter((step) => !stepIsDone(step)) : [];
      const target = checklist.find(stepIsLate) || checklist[0] || null;
      const title = cleanStepTitle(target);
      return title ? { title, late: stepIsLate(target), project } : null;
    } catch {
      return null;
    }
  };

  const inaugurationStep = async () => {
    const items = await collectRadarItems('inauguracoes');
    const action = actionModelForItem(items);
    if (action) return action;

    const item = items[0] || null;
    const unit = item?.title || document.querySelector('.pmh-inauguration-project-row-main strong')?.textContent?.trim() || '';
    const domStep = domChecklistStep(unit);
    const apiStep = domStep || await apiChecklistStep(unit);
    const dueInfo = due(item?.dueDate);

    if (apiStep) {
      return {
        eyebrow: apiStep.late ? 'PRÓXIMO PASSO · ETAPA ATRASADA' : 'PRÓXIMO PASSO · CHECKLIST',
        title: `Concluir ${apiStep.title}`,
        meta: [unit || apiStep.project?.unit, item?.context, item?.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
        badge: apiStep.late ? 'Etapa atrasada' : dueInfo.label,
        tone: apiStep.late ? 'late' : '',
      };
    }

    if (item) {
      return {
        eyebrow: 'PRÓXIMO PASSO · CHECKLIST',
        title: `Abrir ${item.title} e concluir a próxima etapa pendente`,
        meta: [item.status, item.context, item.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
        badge: dueInfo.label,
        tone: dueInfo.bucket === 'late' ? 'late' : '',
      };
    }

    return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhuma implantação ativa encontrada',
      meta: 'Não há checklist operacional aberto nesta área.',
      badge: 'Sem ação agora',
      tone: 'empty',
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
      eyebrow: 'LEITURA OPERACIONAL',
      title: 'Sem ação operacional pendente',
      meta: `${visitors.toLocaleString('pt-BR')} visita${visitors === 1 ? '' : 's'} em 7 dias · ${conversion}% chegaram ao WhatsApp`,
      badge: 'Leitura do funil',
      tone: 'empty',
    };
  };

  const expansionStep = async () => {
    const payload = await fetchJson(API.expansion);
    const leads = Array.isArray(payload?.data) ? payload.data : [];
    const news = leads
      .filter((lead) => !lead.viewedAt || lead.status === 'new')
      .sort((a, b) => Date.parse(a.createdAt || 0) - Date.parse(b.createdAt || 0));

    if (!news.length) return {
      eyebrow: 'PRÓXIMO PASSO',
      title: 'Nenhum lead novo aguardando revisão',
      meta: 'A fila de Expansão está sem novos candidatos para triagem.',
      badge: 'Fila revisada',
      tone: 'empty',
    };

    const lead = news[0];
    const location = [lead.city, lead.state].filter(Boolean).join(' · ');
    const origin = lead.rdStage || lead.origin || lead.source || '';
    const age = lead.createdAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(lead.createdAt)) : '';

    return {
      eyebrow: 'PRÓXIMO PASSO · EXPANSÃO',
      title: `Revisar ${lead.name || 'lead sem nome'}`,
      meta: [location, origin, age && `Recebido em ${age}`, news.length > 1 && `+ ${news.length - 1} novo${news.length - 1 === 1 ? '' : 's'} na fila`].filter(Boolean).join(' · '),
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
      const dueA = due(a.deadline);
      const dueB = due(b.deadline);
      if (dueA.weight !== dueB.weight) return dueA.weight - dueB.weight;
      const progressA = a.status === 'em_andamento' ? 0 : 1;
      const progressB = b.status === 'em_andamento' ? 0 : 1;
      return progressA - progressB;
    });

    const plan = plans[0];
    const dueInfo = due(plan.deadline);
    const owner = P5_AREA_LABELS[plan.ownerArea] || plan.ownerArea || '';
    const status = plan.status === 'em_andamento' ? 'Em andamento' : 'Aberto';

    return {
      eyebrow: dueInfo.bucket === 'late' ? 'PRÓXIMO PASSO · PLANO ATRASADO' : 'PRÓXIMO PASSO · 5 ESTRELAS',
      title: plan.title || 'Plano de ação sem título',
      meta: [plan.unit, status, owner && `Responsável: ${owner}`, plan.notes].filter(Boolean).join(' · '),
      badge: dueInfo.label,
      tone: dueInfo.bucket === 'late' ? 'late' : '',
    };
  };

  const contentStep = async () => {
    const payload = await fetchJson(API.contents);
    const items = Array.isArray(payload?.data) ? payload.data.filter((item) => item.status !== 'arquivado') : [];

    if (!items.length) return {
      eyebrow: 'PRÓXIMO PASSO · CENTRAL PLANET',
      title: 'Cadastrar o primeiro material da Central Planet',
      meta: 'Nenhum conteúdo ativo foi encontrado no acervo.',
      badge: 'Acervo vazio',
      tone: 'empty',
    };

    const rank = { aprovacao: 0, producao: 1, planejamento: 2, publicado: 3 };
    items.sort((a, b) => {
      const rankA = rank[a.status] ?? 9;
      const rankB = rank[b.status] ?? 9;
      if (rankA !== rankB) return rankA - rankB;
      return Date.parse(a.updatedAt || 0) - Date.parse(b.updatedAt || 0);
    });

    const item = items[0];
    const action = item.status === 'aprovacao'
      ? `Revisar aprovação de ${item.title || 'material sem título'}`
      : item.status === 'producao'
        ? `Continuar produção de ${item.title || 'material sem título'}`
        : item.status === 'planejamento'
          ? `Avançar planejamento de ${item.title || 'material sem título'}`
          : `Revisar ${item.title || 'material sem título'}`;

    return {
      eyebrow: 'PRÓXIMO PASSO · CENTRAL PLANET',
      title: action,
      meta: [item.category, item.campaign, item.unit, item.responsible && `Responsável: ${item.responsible}`].filter(Boolean).join(' · '),
      badge: item.status === 'aprovacao' ? 'Em aprovação' : item.status === 'producao' ? 'Em produção' : item.status === 'planejamento' ? 'Planejamento' : 'Publicado',
      tone: '',
    };
  };

  const stepFor = async (area) => {
    if (area === 'marketing') return marketingStep();
    if (area === 'calendario') return campaignStep();
    if (area === 'inauguracoes') return inaugurationStep();
    if (radarActions[area]) return radarStep(area);
    if (area === 'aquisicao') return acquisitionStep();
    if (area === 'expansao') return expansionStep();
    if (area === '5-estrelas') return fiveStarsStep();
    if (area === 'conteudos') return contentStep();
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
