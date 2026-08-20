(() => {
  'use strict';

  const ROUTES = new Set(['5-estrelas', 'cinco-estrelas', '5estrelas']);
  const API = '/api/hub/planet/five-stars/action-plans';
  const EVALUATIONS_API = '/api/hub/planet/five-stars/evaluations';
  const LIMITS = { commercial: 35, experience: 25, marketing: 20, management: 20 };
  const PILLAR_LABELS = {
    commercial: 'Resultado Comercial', experience: 'Experiência do Cliente', marketing: 'Marketing e Participação',
    management: 'Gestão da Franquia', requirements: 'Requisitos de 5 estrelas', other: 'Outro ponto',
  };
  const AREA_LABELS = { marketing: 'Marketing', campanhas: 'Campanhas', chamados: 'Chamados', unidade: 'Unidade / Franqueado' };
  const STATUS_LABELS = { aberto: 'Aberto', em_andamento: 'Em andamento', concluido: 'Concluído' };
  const state = { plans: [], loaded: false, evaluations: null };
  let frame = 0;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const hash = () => String(location.hash || '').replace(/^#/, '').toLowerCase();
  const active = () => ROUTES.has(hash());
  const page = () => document.querySelector('[data-p5-page]');
  const content = () => page()?.querySelector('[data-p5-content]');
  const selectedTab = () => page()?.querySelector('[data-p5-tab].active')?.dataset.p5Tab || '';
  const normalizeUnit = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const formatDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value.split('-').reverse().join('/') : 'Sem prazo';
  const isLate = (plan, reference = today()) => plan.status !== 'concluido' && plan.deadline && plan.deadline < reference;

  const biggestGap = (evaluation) => {
    if (!evaluation?.scores) return null;
    let best = null;
    Object.entries(LIMITS).forEach(([pillar, max]) => {
      const score = Math.min(max, Math.max(0, Number(evaluation.scores?.[pillar]) || 0));
      const gap = (max - score) / max;
      if (!best || gap > best.gap) best = { pillar, label: PILLAR_LABELS[pillar], score, max, gap };
    });
    return best;
  };

  const firstOpenPlan = (unit, plans = [], reference = today()) => {
    const key = normalizeUnit(unit);
    return [...plans]
      .filter((plan) => normalizeUnit(plan.unit) === key && ['aberto', 'em_andamento'].includes(plan.status))
      .sort((a, b) => {
        const dueA = /^\d{4}-\d{2}-\d{2}$/.test(String(a.deadline || '')) ? a.deadline : '9999-12-31';
        const dueB = /^\d{4}-\d{2}-\d{2}$/.test(String(b.deadline || '')) ? b.deadline : '9999-12-31';
        if (dueA !== dueB) return dueA.localeCompare(dueB);
        const timeA = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
        const timeB = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
        if (timeA !== timeB) return timeB - timeA;
        return String(a.id || '').localeCompare(String(b.id || ''));
      })[0] || null;
  };

  const unitGuidance = (unit, evaluation, plans = [], reference = today()) => ({
    gap: biggestGap(evaluation),
    plan: firstOpenPlan(unit, plans, reference),
  });

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const loadPlans = async (force = false) => {
    if (state.loaded && !force) return state.plans;
    const payload = await apiJson(API);
    state.plans = Array.isArray(payload.data) ? payload.data : [];
    state.loaded = true;
    return state.plans;
  };

  const loadEvaluations = async () => {
    if (Array.isArray(state.evaluations)) return state.evaluations;
    const payload = await apiJson(EVALUATIONS_API);
    state.evaluations = Array.isArray(payload.data) ? payload.data : [];
    return state.evaluations;
  };

  const latestEvaluationForUnit = async (unit) => {
    const normalized = normalizeUnit(unit);
    const evaluations = await loadEvaluations();
    return evaluations
      .filter((item) => normalizeUnit(item.unit) === normalized)
      .sort((a, b) => `${b.cycle || ''}:${b.evaluatedAt || ''}`.localeCompare(`${a.cycle || ''}:${a.evaluatedAt || ''}`))[0] || null;
  };

  const suggestionFor = (evaluation) => {
    if (!evaluation) return { pillar: 'other', title: '' };
    const requirements = evaluation.requirements || {};
    if (Number(evaluation.total) >= 90 && ['hiddenShopper', 'reportsOnTime', 'noSeriousPending'].some((key) => requirements[key] !== 'ok')) {
      return { pillar: 'requirements', title: 'Regularizar requisito pendente para certificação 5 estrelas' };
    }
    const gap = biggestGap(evaluation);
    const pillar = gap?.pillar || 'other';
    return { pillar, title: `Evoluir ${PILLAR_LABELS[pillar] || 'ponto da avaliação'}` };
  };

  const statsMarkup = () => {
    const open = state.plans.filter((plan) => plan.status !== 'concluido').length;
    const late = state.plans.filter((plan) => isLate(plan)).length;
    const done = state.plans.filter((plan) => plan.status === 'concluido').length;
    return `<div class="p5-action-stats"><span><small>ABERTOS</small><strong>${open}</strong></span><span class="${late ? 'danger' : ''}"><small>ATRASADOS</small><strong>${late}</strong></span><span><small>CONCLUÍDOS</small><strong>${done}</strong></span></div>`;
  };

  const areaDestination = (area) => ({ marketing: '#marketing', campanhas: '#calendario', chamados: '#chamados' }[area] || '');

  const planCards = () => {
    if (!state.plans.length) return `<section class="p5-panel p5-action-empty"><div class="p5-empty-icon">✓</div><strong>Nenhum plano de ação aberto</strong><span>Crie o primeiro plano manualmente ou abra uma unidade e transforme a principal lacuna em ação.</span><button type="button" data-p5-new-plan>+ Novo plano de ação</button></section>`;
    return `<div class="p5-action-list">${state.plans.map((plan) => {
      const destination = areaDestination(plan.ownerArea);
      return `<article class="p5-action-card ${isLate(plan) ? 'late' : ''} ${plan.status === 'concluido' ? 'done' : ''}">
        <header><span class="p5-action-status ${esc(plan.status)}">${esc(STATUS_LABELS[plan.status] || plan.status)}</span><small>${esc(plan.unit)}</small></header>
        <h3>${esc(plan.title)}</h3>
        <div class="p5-action-meta"><span><b>Pilar</b>${esc(PILLAR_LABELS[plan.pillar] || PILLAR_LABELS.other)}</span><span><b>Responsável</b>${esc(AREA_LABELS[plan.ownerArea] || AREA_LABELS.unidade)}</span><span><b>Prazo</b>${isLate(plan) ? 'Atrasado · ' : ''}${esc(formatDate(plan.deadline))}</span></div>
        ${plan.notes ? `<p>${esc(plan.notes)}</p>` : ''}
        <footer><button type="button" data-p5-edit-plan="${esc(plan.id)}">Editar</button>${destination ? `<button type="button" class="secondary" data-p5-plan-destination="${esc(destination)}">Abrir ${esc(AREA_LABELS[plan.ownerArea])}</button>` : ''}</footer>
      </article>`;
    }).join('')}</div>`;
  };

  const renderActions = async () => {
    if (!active() || selectedTab() !== 'actions') return;
    const target = content();
    if (!target) return;
    target.innerHTML = '<section class="p5-panel p5-action-loading">Carregando planos de ação…</section>';
    try {
      await loadPlans();
      if (!target.isConnected || selectedTab() !== 'actions') return;
      target.innerHTML = `<section class="p5-action-stack"><header class="p5-action-head"><div><small>PLANOS DE AÇÃO</small><h3>Da avaliação para a correção</h3><p>Uma lacuna vira ação com responsável, prazo e estado. Sem criar tarefa paralela no Radar.</p></div><button type="button" data-p5-new-plan>+ Novo plano</button></header>${statsMarkup()}${planCards()}</section>`;
    } catch (error) {
      if (target.isConnected) target.innerHTML = `<section class="p5-panel p5-action-empty"><strong>Não consegui carregar os planos.</strong><span>${esc(error.message)}</span><button type="button" data-p5-reload-plans>Tentar novamente</button></section>`;
    }
  };

  const guidanceMarkup = (unit, evaluation) => {
    const guidance = unitGuidance(unit, evaluation, state.plans);
    const gap = guidance.gap;
    const plan = guidance.plan;
    return `<div class="p5-unit-guidance" data-p5-unit-guidance>
      <span><small>MAIOR OPORTUNIDADE</small>${gap ? `<strong>${esc(gap.label)}</strong><em>${gap.score.toLocaleString('pt-BR')}/${gap.max}</em>` : '<strong>Sem avaliação registrada</strong>'}</span>
      <span><small>AÇÃO PENDENTE</small>${plan ? `<strong>${esc(plan.title)}</strong><em>${esc(STATUS_LABELS[plan.status] || plan.status)} · ${esc(formatDate(plan.deadline))}${isLate(plan) ? ' · <b>ATRASADA</b>' : ''}</em>` : '<strong>Nenhuma ação pendente</strong>'}</span>
    </div>`;
  };

  const decorateUnitRows = async () => {
    if (!active() || selectedTab() !== 'units') return;
    try { await Promise.all([loadPlans(), loadEvaluations()]); } catch { return; }
    if (!active() || selectedTab() !== 'units') return;
    document.querySelectorAll('[data-p5-page] .p5-unit-row').forEach((row) => {
      const unit = row.querySelector('.p5-unit-main strong')?.textContent?.trim();
      if (!unit) return;
      const evaluation = state.evaluations
        .filter((item) => normalizeUnit(item.unit) === normalizeUnit(unit))
        .sort((a, b) => `${b.cycle || ''}:${b.evaluatedAt || ''}`.localeCompare(`${a.cycle || ''}:${a.evaluatedAt || ''}`))[0] || null;
      row.querySelector('[data-p5-unit-guidance]')?.remove();
      const anchor = row.querySelector('.p5-row-action');
      anchor?.insertAdjacentHTML('beforebegin', guidanceMarkup(unit, evaluation));
      if (!row.querySelector('[data-p5-plan-unit]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'p5-row-action p5-plan-unit-button';
        button.dataset.p5PlanUnit = unit;
        button.textContent = '+ Plano';
        row.appendChild(button);
      }
    });
  };

  const openModal = async (plan = null, unit = '') => {
    document.querySelector('[data-p5-plan-modal]')?.remove();
    let suggested = { pillar: 'other', title: '' };
    if (!plan && unit) {
      try { suggested = suggestionFor(await latestEvaluationForUnit(unit)); } catch { suggested = { pillar: 'other', title: '' }; }
    }
    const current = plan || {
      unit, title: suggested.title, pillar: suggested.pillar, ownerArea: 'unidade', deadline: '', status: 'aberto', notes: '',
    };
    const backdrop = document.createElement('div');
    backdrop.className = 'p5-action-modal-backdrop';
    backdrop.dataset.p5PlanModal = 'true';
    backdrop.innerHTML = `<section class="p5-action-modal" role="dialog" aria-modal="true"><header><div><small>PLANET 5 ESTRELAS</small><h2>${plan ? 'Editar plano de ação' : 'Novo plano de ação'}</h2><p>Transforme uma lacuna em algo executável: ação, responsável e prazo.</p></div><button type="button" data-p5-close-plan>×</button></header><form data-p5-plan-form data-plan-id="${esc(plan?.id || '')}">
      <div class="p5-action-form-grid"><label><span>Unidade</span><input name="unit" value="${esc(current.unit)}" maxlength="180" required></label><label><span>Estado</span><select name="status"><option value="aberto" ${current.status === 'aberto' ? 'selected' : ''}>Aberto</option><option value="em_andamento" ${current.status === 'em_andamento' ? 'selected' : ''}>Em andamento</option><option value="concluido" ${current.status === 'concluido' ? 'selected' : ''}>Concluído</option></select></label></div>
      <label><span>Ação</span><input name="title" value="${esc(current.title)}" maxlength="220" placeholder="Ex.: corrigir adesão às campanhas" required></label>
      <div class="p5-action-form-grid"><label><span>Origem da lacuna</span><select name="pillar">${Object.entries(PILLAR_LABELS).map(([value, label]) => `<option value="${value}" ${current.pillar === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label><label><span>Quem executa</span><select name="ownerArea">${Object.entries(AREA_LABELS).map(([value, label]) => `<option value="${value}" ${current.ownerArea === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label></div>
      <label><span>Prazo</span><input name="deadline" type="date" value="${esc(current.deadline || '')}"></label>
      <label><span>Observação</span><textarea name="notes" maxlength="1800" rows="3" placeholder="Contexto necessário para executar a correção">${esc(current.notes || '')}</textarea></label>
      <div class="p5-action-form-error" data-p5-plan-error hidden></div>
      <footer>${plan ? '<button type="button" class="danger" data-p5-delete-plan>Excluir</button>' : '<span></span>'}<div><button type="button" class="secondary" data-p5-close-plan>Cancelar</button><button type="submit">Salvar plano</button></div></footer>
    </form></section>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.querySelector('input[name="title"]')?.focus());
  };

  const savePlan = async (form) => {
    const data = new FormData(form);
    const plan = {
      ...(form.dataset.planId ? { id: form.dataset.planId } : {}),
      unit: String(data.get('unit') || '').trim(), title: String(data.get('title') || '').trim(),
      pillar: String(data.get('pillar') || 'other'), ownerArea: String(data.get('ownerArea') || 'unidade'),
      deadline: String(data.get('deadline') || ''), status: String(data.get('status') || 'aberto'), notes: String(data.get('notes') || '').trim(),
    };
    const error = form.querySelector('[data-p5-plan-error]');
    const buttons = form.querySelectorAll('button');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await apiJson(API, { method: 'POST', body: JSON.stringify({ plan }) });
      document.querySelector('[data-p5-plan-modal]')?.remove();
      state.loaded = false;
      await loadPlans(true);
      if (selectedTab() === 'actions') renderActions();
      if (selectedTab() === 'units') decorateUnitRows();
    } catch (cause) {
      if (error) { error.textContent = cause.message; error.hidden = false; }
      buttons.forEach((button) => { button.disabled = false; });
    }
  };

  const deletePlan = async (form) => {
    const id = form.dataset.planId;
    if (!id) return;
    const plan = state.plans.find((item) => item.id === id);
    if (!window.confirm(`Excluir o plano "${plan?.title || 'selecionado'}"?`)) return;
    await apiJson(API, { method: 'DELETE', body: JSON.stringify({ id }) });
    document.querySelector('[data-p5-plan-modal]')?.remove();
    state.loaded = false;
    await loadPlans(true);
    renderActions();
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!active()) return;
      if (selectedTab() === 'actions') renderActions();
      if (selectedTab() === 'units') decorateUnitRows();
    }));
  };

  document.addEventListener('click', (event) => {
    if (!active() && !event.target.closest?.('[data-p5-plan-modal]')) return;
    const tab = event.target.closest?.('[data-p5-tab]');
    if (tab) { requestAnimationFrame(schedule); return; }
    if (event.target.closest?.('[data-p5-new-plan]')) { openModal(); return; }
    const unitButton = event.target.closest?.('[data-p5-plan-unit]');
    if (unitButton) { openModal(null, unitButton.dataset.p5PlanUnit); return; }
    const edit = event.target.closest?.('[data-p5-edit-plan]');
    if (edit) { const plan = state.plans.find((item) => item.id === edit.dataset.p5EditPlan); if (plan) openModal(plan); return; }
    if (event.target.closest?.('[data-p5-close-plan]') || event.target.matches?.('[data-p5-plan-modal]')) { document.querySelector('[data-p5-plan-modal]')?.remove(); return; }
    const remove = event.target.closest?.('[data-p5-delete-plan]');
    if (remove) { const form = remove.closest('[data-p5-plan-form]'); if (form) deletePlan(form).catch((error) => window.alert(error.message)); return; }
    if (event.target.closest?.('[data-p5-reload-plans]')) { state.loaded = false; renderActions(); return; }
    const destination = event.target.closest?.('[data-p5-plan-destination]');
    if (destination) location.hash = destination.dataset.p5PlanDestination;
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-p5-plan-form]');
    if (!form) return;
    event.preventDefault();
    savePlan(form);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelector('[data-p5-plan-modal]')?.remove();
  });

  window.PlanetFiveStarsGuidance = Object.freeze({ biggestGap, firstOpenPlan, unitGuidance });
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pmh:view-rendered', schedule);
  window.addEventListener('planet:five-stars-rendered', schedule);
  window.addEventListener('planet:five-stars-evaluations-updated', () => { state.evaluations = null; schedule(); });
  window.addEventListener('pmh:access-ready', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();