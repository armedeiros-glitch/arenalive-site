(() => {
  'use strict';

  const API = '/api/hub/demandas-internas';
  const ORGANIZE_API = '/api/hub/organizar-demanda';
  const LOCAL_KEY = 'planet-hub-internal-demands-v1';

  const LABELS = {
    origin: {
      direction: 'Direção',
      meeting: 'Reunião',
      whatsapp: 'WhatsApp',
      internal: 'Operação interna',
      other: 'Outra origem',
    },
    priority: {
      urgent: 'Urgente',
      high: 'Alta',
      normal: 'Normal',
      low: 'Baixa',
    },
    status: {
      new: 'Nova',
      in_progress: 'Em andamento',
      waiting: 'Aguardando',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    },
  };

  const ACTIVE_STATUS = new Set(['new', 'in_progress', 'waiting']);
  const PRIORITY_WEIGHT = Object.freeze({ urgent: 0, high: 1, normal: 2, low: 3 });

  const state = {
    items: [],
    revision: null,
    shared: false,
    loaded: false,
    loading: null,
    saving: false,
    preview: null,
    editingId: '',
    inputText: '',
    aiMessage: '',
    deletedIds: new Set(),
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const nowIso = () => new Date().toISOString();
  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const normalizeSteps = (items) => (Array.isArray(items) ? items : [])
    .slice(0, 12)
    .map((item) => ({
      id: String(item?.id || `step-${crypto.randomUUID()}`),
      text: String(typeof item === 'string' ? item : item?.text || '').trim().slice(0, 260),
      done: Boolean(item?.done),
    }))
    .filter((item) => item.text);

  const normalizeDemand = (item = {}) => ({
    id: String(item.id || `demand-${crypto.randomUUID()}`),
    title: String(item.title || 'Demanda sem título').trim().slice(0, 220),
    description: String(item.description || '').trim().slice(0, 1600),
    origin: LABELS.origin[item.origin] ? item.origin : 'direction',
    requestedBy: String(item.requestedBy || '').trim().slice(0, 160),
    responsible: String(item.responsible || '').trim().slice(0, 160),
    priority: LABELS.priority[item.priority] ? item.priority : 'normal',
    status: LABELS.status[item.status] ? item.status : 'new',
    dueDate: cleanDate(item.dueDate),
    category: String(item.category || '').trim().slice(0, 120),
    notes: String(item.notes || '').trim().slice(0, 1800),
    steps: normalizeSteps(item.steps),
    originalText: String(item.originalText || '').trim().slice(0, 4000),
    aiMode: ['ai', 'rules', 'manual'].includes(item.aiMode) ? item.aiMode : 'manual',
    createdAt: String(item.createdAt || nowIso()),
    updatedAt: String(item.updatedAt || nowIso()),
    completedAt: String(item.completedAt || ''),
  });

  const mount = () => document.querySelector('[data-internal-demands]');
  const readLocal = () => {
    try {
      const payload = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
      const items = Array.isArray(payload) ? payload : payload.data;
      return Array.isArray(items) ? items.map(normalizeDemand) : [];
    } catch (_) {
      return [];
    }
  };
  const writeLocal = () => localStorage.setItem(LOCAL_KEY, JSON.stringify({ data: state.items, updatedAt: nowIso() }));

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Falha HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const mergeItems = (...collections) => {
    const merged = new Map();
    collections.flat().forEach((raw) => {
      const item = normalizeDemand(raw);
      if (state.deletedIds.has(item.id)) return;
      const current = merged.get(item.id);
      if (!current || Date.parse(item.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) merged.set(item.id, item);
    });
    return [...merged.values()];
  };

  const notifyUpdated = () => document.dispatchEvent(new CustomEvent('pmh:demands-updated'));

  const load = async () => {
    if (state.loaded) return;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      const local = readLocal();
      try {
        const payload = await apiJson(API);
        state.items = mergeItems(payload.data || [], local);
        state.revision = payload.revision || null;
        state.shared = true;
        writeLocal();
        if (local.length && JSON.stringify(state.items) !== JSON.stringify(payload.data || [])) await save(false);
      } catch (_) {
        state.items = local;
        state.shared = false;
      }
      state.loaded = true;
      state.loading = null;
    })();
    return state.loading;
  };

  const save = async (rerender = true, retried = false) => {
    state.items = state.items.map(normalizeDemand);
    writeLocal();
    state.saving = true;
    try {
      const payload = await apiJson(API, {
        method: 'PUT',
        body: JSON.stringify({ data: state.items, baseRevision: state.revision }),
      });
      state.items = (payload.data || state.items)
        .map(normalizeDemand)
        .filter((item) => !state.deletedIds.has(item.id));
      state.revision = payload.revision || state.revision;
      state.shared = true;
      state.deletedIds.clear();
      writeLocal();
    } catch (error) {
      if (!retried && error.status === 409 && error.payload?.data) {
        state.items = mergeItems(error.payload.data, state.items);
        state.revision = error.payload.revision || null;
        return save(rerender, true);
      }
      state.shared = false;
      toast('Salvo neste navegador, mas a sincronização falhou.', 'error');
    } finally {
      state.saving = false;
    }
    if (rerender) render();
    notifyUpdated();
  };

  const toast = (message, tone = 'success') => {
    document.querySelector('.pmh-demand-toast')?.remove();
    const element = document.createElement('div');
    element.className = `pmh-demand-toast ${tone}`;
    element.textContent = message;
    document.body.appendChild(element);
    requestAnimationFrame(() => element.classList.add('visible'));
    setTimeout(() => {
      element.classList.remove('visible');
      setTimeout(() => element.remove(), 220);
    }, 2600);
  };

  const options = (map, selected) => Object.entries(map)
    .map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`)
    .join('');

  const fmtDate = (value) => {
    if (!value) return 'Sem prazo';
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? 'Sem prazo' : new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const dayDiff = (value, reference = todayIso()) => {
    const due = cleanDate(value);
    const today = cleanDate(reference);
    if (!due || !today) return null;
    const dueDate = new Date(`${due}T12:00:00`);
    const todayDate = new Date(`${today}T12:00:00`);
    if (Number.isNaN(dueDate.getTime()) || Number.isNaN(todayDate.getTime())) return null;
    return Math.round((dueDate - todayDate) / 86400000);
  };

  const dueMeta = (value, reference = todayIso()) => {
    const diff = dayDiff(value, reference);
    if (diff == null) return { label: 'Sem prazo', tone: 'none', weight: 90000 };
    if (diff < 0) {
      const elapsed = Math.abs(diff);
      return { label: `ATRASADA · ${elapsed} ${elapsed === 1 ? 'dia' : 'dias'}`, tone: 'late', weight: diff };
    }
    if (diff === 0) return { label: 'VENCE HOJE', tone: 'today', weight: 0 };
    if (diff <= 7) return { label: `em ${diff} ${diff === 1 ? 'dia' : 'dias'}`, tone: 'soon', weight: diff };
    return { label: fmtDate(value), tone: 'later', weight: diff };
  };

  const sortActiveDemands = (items, reference = todayIso()) => (Array.isArray(items) ? items : [])
    .filter((item) => ACTIVE_STATUS.has(item.status))
    .sort((a, b) => {
      const dueA = dueMeta(a.dueDate, reference).weight;
      const dueB = dueMeta(b.dueDate, reference).weight;
      if (dueA !== dueB) return dueA - dueB;
      const priorityA = PRIORITY_WEIGHT[a.priority] ?? PRIORITY_WEIGHT.normal;
      const priorityB = PRIORITY_WEIGHT[b.priority] ?? PRIORITY_WEIGHT.normal;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
    });

  const nextStepMeta = (steps) => {
    const list = Array.isArray(steps) ? steps : [];
    if (!list.length) return null;
    const pending = list.find((step) => step && !step.done && String(step.text || '').trim());
    if (pending) return { state: 'pending', text: String(pending.text).trim() };
    return { state: 'completed', text: '' };
  };

  const renderPreview = () => {
    if (!state.preview) return '';
    const item = normalizeDemand(state.preview.data || {});
    const warnings = Array.isArray(state.preview.warnings) ? state.preview.warnings : [];
    const modeLabel = state.preview.mode === 'ai' ? 'Organizado com IA' : state.preview.mode === 'rules' ? 'Organizado localmente' : 'Cadastro manual';
    return `<form class="pmh-demand-preview" data-demand-preview>
      <header><div><small>PRÉVIA EDITÁVEL · ${esc(modeLabel)}</small><h3>Confirme antes de registrar</h3><p>A IA apenas estruturou a ideia. Você continua no volante.</p></div><button type="button" data-demand-cancel aria-label="Fechar">×</button></header>
      ${warnings.length ? `<div class="pmh-demand-warnings">${warnings.map((warning) => `<span>⚠ ${esc(warning)}</span>`).join('')}</div>` : ''}
      <div class="pmh-demand-form-grid">
        <label class="wide">Título<input name="title" required maxlength="220" value="${esc(item.title)}"></label>
        <label class="wide">Descrição<textarea name="description" maxlength="1600">${esc(item.description)}</textarea></label>
        <label>Origem<select name="origin">${options(LABELS.origin, item.origin)}</select></label>
        <label>Solicitado por<input name="requestedBy" maxlength="160" value="${esc(item.requestedBy)}"></label>
        <label>Responsável<input name="responsible" maxlength="160" value="${esc(item.responsible)}" placeholder="Pode ficar em branco"></label>
        <label>Prioridade<select name="priority">${options(LABELS.priority, item.priority)}</select></label>
        <label>Status<select name="status">${options({ new: 'Nova', in_progress: 'Em andamento', waiting: 'Aguardando' }, item.status)}</select></label>
        <label>Prazo<input name="dueDate" type="date" value="${esc(item.dueDate)}"></label>
        <label>Categoria<input name="category" maxlength="120" value="${esc(item.category)}"></label>
        <label class="wide">Etapas sugeridas<textarea name="steps" maxlength="2200" placeholder="Uma etapa por linha">${esc(item.steps.map((step) => step.text).join('\n'))}</textarea></label>
        <label class="wide">Observações<textarea name="notes" maxlength="1800">${esc(item.notes)}</textarea></label>
      </div>
      <footer><span>${state.shared ? 'Será salvo para toda a equipe.' : 'Será salvo neste navegador enquanto o compartilhamento não estiver disponível.'}</span><button type="button" data-demand-cancel>Cancelar</button><button class="primary" type="submit">${state.editingId ? 'Salvar alterações' : 'Confirmar demanda'}</button></footer>
    </form>`;
  };

  const renderActiveQueue = () => {
    const active = sortActiveDemands(state.items);
    return `<section class="pmh-demand-active" data-demand-active-queue>
      <header><div><small>EXECUÇÃO</small><h3>Demandas em andamento</h3><p>Prazo primeiro, depois prioridade e atualização.</p></div><b>${active.length}</b></header>
      <div class="pmh-demand-active-list">${active.length ? active.map((item) => {
        const due = dueMeta(item.dueDate);
        const nextStep = nextStepMeta(item.steps);
        return `<article class="pmh-demand-active-card status-${esc(item.status)} priority-${esc(item.priority)}">
          <div class="pmh-demand-active-main">
            <div class="pmh-demand-active-title"><span>${esc(LABELS.status[item.status] || item.status)}</span><h4>${esc(item.title)}</h4></div>
            <div class="pmh-demand-active-meta">
              <span><small>Responsável</small><strong>${esc(item.responsible || 'Sem responsável')}</strong></span>
              <span><small>Status</small><strong>${esc(LABELS.status[item.status] || item.status)}</strong></span>
              <span><small>Prioridade</small><strong>${esc(LABELS.priority[item.priority] || item.priority)}</strong></span>
              <span><small>Prazo</small><strong>${esc(fmtDate(item.dueDate))}</strong></span>
            </div>
            ${nextStep ? `<div class="pmh-demand-next-step ${nextStep.state === 'completed' ? 'is-complete' : ''}"><small>${nextStep.state === 'completed' ? 'ETAPAS CONCLUÍDAS' : 'PRÓXIMA ETAPA'}</small>${nextStep.state === 'pending' ? `<strong title="${esc(nextStep.text)}">${esc(nextStep.text)}</strong>` : ''}</div>` : ''}
          </div>
          <aside>
            <span class="pmh-demand-due tone-${esc(due.tone)}">${esc(due.label)}</span>
            <div><button type="button" data-demand-edit="${esc(item.id)}">Editar</button><button type="button" class="primary" data-demand-complete="${esc(item.id)}">Concluir</button></div>
          </aside>
        </article>`;
      }).join('') : '<div class="pmh-demand-active-empty"><strong>Nenhuma demanda ativa no momento.</strong><span>Novas demandas aparecerão aqui assim que forem registradas.</span></div>'}</div>
    </section>`;
  };

  const renderArchive = () => {
    const completed = state.items
      .filter((item) => item.status === 'completed')
      .sort((a, b) => Date.parse(b.completedAt || b.updatedAt || 0) - Date.parse(a.completedAt || a.updatedAt || 0));
    if (!completed.length) return '';

    return `<details class="pmh-demand-archive">
      <summary><span>Demandas concluídas</span><b>${completed.length}</b></summary>
      <div>${completed.map((item) => `<article>
        <div><strong>${esc(item.title)}</strong><small>${esc(item.responsible || 'Sem responsável')} · ${esc(fmtDate(item.dueDate))}</small></div>
        <div><button type="button" data-demand-reopen="${esc(item.id)}">Reabrir</button><button type="button" data-demand-delete="${esc(item.id)}">Excluir</button></div>
      </article>`).join('')}</div>
    </details>`;
  };

  const render = () => {
    const target = mount();
    if (!target) return;
    if (!state.loaded) {
      target.innerHTML = '<div class="pmh-demand-loading">Carregando demandas internas…</div>';
      return;
    }

    target.innerHTML = `<section class="pmh-demand-capture pmh-demand-capture-compact">
      <div><small>NOVA DEMANDA INTERNA</small><h3>Descreva. A IA organiza.</h3><p>Escreva do seu jeito e revise antes de registrar.</p></div>
      <textarea data-demand-input maxlength="4000" placeholder="Ex.: A direção pediu uma campanha para os colaboradores dos shoppings até o fim do mês. A Ágata faz as artes e eu aprovo.">${esc(state.inputText)}</textarea>
      <footer><span>${esc(state.aiMessage || 'Você revisa tudo antes de salvar.')}</span><button type="button" class="pmh-demand-manual-compact" data-demand-manual>Cadastro manual</button><button type="button" data-demand-organize>✨ Organizar demanda</button></footer>
    </section>
    ${renderPreview()}
    ${renderActiveQueue()}
    ${renderArchive()}`;
  };

  const mountHome = async () => {
    if (!mount()) return;
    render();
    await load();
    render();
  };

  const previewFromData = (data, mode = 'manual', warnings = []) => {
    state.preview = { data: normalizeDemand(data), mode, warnings };
    render();
    requestAnimationFrame(() => mount()?.querySelector('[data-demand-preview]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const organize = async () => {
    const input = mount()?.querySelector('[data-demand-input]');
    const text = String(input?.value || '').trim();
    if (text.length < 8) return toast('Descreva um pouco melhor a demanda.', 'error');
    state.inputText = text;
    const button = mount()?.querySelector('[data-demand-organize]');
    if (button) { button.disabled = true; button.textContent = 'Organizando…'; }
    try {
      const payload = await apiJson(ORGANIZE_API, {
        method: 'POST',
        body: JSON.stringify({ text, today: todayIso() }),
      });
      state.aiMessage = payload.aiConfigured
        ? payload.aiFailed ? 'A IA falhou nesta tentativa; usei o organizador local.' : 'Prévia criada pela IA. Revise antes de confirmar.'
        : 'Workers AI ainda não está conectado; usei o organizador local.';
      state.editingId = '';
      previewFromData({ ...payload.data, originalText: text, aiMode: payload.mode }, payload.mode, payload.warnings || []);
    } catch (error) {
      toast(error.message || 'Não foi possível organizar a demanda.', 'error');
      if (button) { button.disabled = false; button.textContent = '✨ Organizar demanda'; }
    }
  };

  const previewSubmit = async (form) => {
    const values = Object.fromEntries(new FormData(form));
    const existing = state.editingId ? state.items.find((item) => item.id === state.editingId) : null;
    const steps = String(values.steps || '').split('\n').map((text) => text.trim()).filter(Boolean);
    const currentSteps = new Map((existing?.steps || []).map((step) => [normalizeText(step.text), step]));
    const item = normalizeDemand({
      ...(existing || {}),
      ...state.preview?.data,
      ...values,
      id: existing?.id || `demand-${crypto.randomUUID()}`,
      steps: steps.map((text) => ({ ...(currentSteps.get(normalizeText(text)) || {}), text })),
      originalText: state.preview?.data?.originalText || state.inputText,
      aiMode: state.preview?.mode || existing?.aiMode || 'manual',
      createdAt: existing?.createdAt || nowIso(),
      updatedAt: nowIso(),
      completedAt: values.status === 'completed' ? existing?.completedAt || nowIso() : '',
    });

    const index = state.items.findIndex((candidate) => candidate.id === item.id);
    if (index >= 0) state.items[index] = item;
    else state.items.unshift(item);
    state.preview = null;
    state.editingId = '';
    state.inputText = '';
    state.aiMessage = '';
    await save();
    toast(existing ? 'Demanda atualizada.' : 'Demanda interna registrada.');
  };

  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-demand-input]')) state.inputText = event.target.value;
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-demand-preview]');
    if (!form) return;
    event.preventDefault();
    previewSubmit(form);
  });

  document.addEventListener('change', async (event) => {
    const checkbox = event.target.closest('[data-demand-step]');
    if (!checkbox) return;
    const item = state.items.find((candidate) => candidate.id === checkbox.dataset.demandId);
    const step = item?.steps.find((candidate) => candidate.id === checkbox.dataset.demandStep);
    if (!item || !step) return;
    step.done = checkbox.checked;
    item.updatedAt = nowIso();
    await save();
  });

  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-demand-organize]')) return organize();
    if (event.target.closest('[data-demand-cancel]')) {
      state.preview = null;
      state.editingId = '';
      return render();
    }
    if (event.target.closest('[data-demand-manual]')) {
      state.editingId = '';
      return previewFromData({ title: '', origin: 'direction', priority: 'normal', status: 'new', steps: [] }, 'manual');
    }

    const edit = event.target.closest('[data-demand-edit]');
    if (edit) {
      await load();
      const item = state.items.find((candidate) => candidate.id === edit.dataset.demandEdit);
      if (!item) return;
      state.editingId = item.id;
      return previewFromData(item, item.aiMode || 'manual');
    }

    const complete = event.target.closest('[data-demand-complete]');
    if (complete) {
      const item = state.items.find((candidate) => candidate.id === complete.dataset.demandComplete);
      if (!item) return;
      item.status = 'completed';
      item.completedAt = nowIso();
      item.updatedAt = nowIso();
      await save();
      return toast('Demanda concluída.');
    }

    const reopen = event.target.closest('[data-demand-reopen]');
    if (reopen) {
      const item = state.items.find((candidate) => candidate.id === reopen.dataset.demandReopen);
      if (!item) return;
      item.status = 'in_progress';
      item.completedAt = '';
      item.updatedAt = nowIso();
      await save();
      return toast('Demanda reaberta.');
    }

    const remove = event.target.closest('[data-demand-delete]');
    if (remove) {
      const item = state.items.find((candidate) => candidate.id === remove.dataset.demandDelete);
      if (!item || !confirm(`Excluir a demanda “${item.title}”?`)) return;
      state.deletedIds.add(item.id);
      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      await save();
      return toast('Demanda excluída.');
    }
  });

  window.PlanetInternalDemandsQueue = Object.freeze({ dueMeta, sortActiveDemands, nextStepMeta });

  window.addEventListener('pmh:view-rendered', (event) => {
    if (event.detail?.view === 'inicio') mountHome();
  });
})();