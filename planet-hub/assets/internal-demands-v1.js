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
  const todayIso = () => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return formatter.format(new Date());
  };

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
      const current = merged.get(item.id);
      if (!current || Date.parse(item.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) merged.set(item.id, item);
    });
    return [...merged.values()];
  };

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
      state.items = (payload.data || state.items).map(normalizeDemand);
      state.revision = payload.revision || state.revision;
      state.shared = true;
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
  };

  const isHome = () => normalizeText(document.querySelector('[data-title]')?.textContent).includes('painel de marketing');
  const mount = () => document.querySelector('[data-internal-demands]');

  const dateValue = (value) => {
    if (!value) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const fmtDate = (value) => {
    const date = dateValue(value);
    return date ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Sem prazo';
  };

  const dayDiff = (value) => {
    const due = dateValue(value);
    if (!due) return null;
    const today = dateValue(todayIso());
    return Math.round((due - today) / 86400000);
  };

  const dueInfo = (item) => {
    const diff = dayDiff(item.dueDate);
    if (diff == null) return { label: 'Sem prazo', tone: 'none' };
    if (diff < 0) return { label: `Atrasada há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dia' : 'dias'}`, tone: 'late' };
    if (diff === 0) return { label: 'Vence hoje', tone: 'today' };
    if (diff === 1) return { label: 'Vence amanhã', tone: 'soon' };
    if (diff <= 7) return { label: `Vence em ${diff} dias`, tone: 'soon' };
    return { label: fmtDate(item.dueDate), tone: 'later' };
  };

  const priorityWeight = { urgent: 0, high: 1, normal: 2, low: 3 };
  const sortedActive = () => state.items
    .filter((item) => !['completed', 'cancelled'].includes(item.status))
    .sort((a, b) => {
      const dueA = dayDiff(a.dueDate);
      const dueB = dayDiff(b.dueDate);
      const safeA = dueA == null ? 99999 : dueA;
      const safeB = dueB == null ? 99999 : dueB;
      if (safeA !== safeB) return safeA - safeB;
      const priority = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (priority !== 0) return priority;
      return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
    });

  const completedItems = () => state.items
    .filter((item) => item.status === 'completed')
    .sort((a, b) => Date.parse(b.completedAt || b.updatedAt || 0) - Date.parse(a.completedAt || a.updatedAt || 0));

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

  const renderPreview = () => {
    if (!state.preview) return '';
    const item = normalizeDemand(state.preview.data || {});
    const warnings = Array.isArray(state.preview.warnings) ? state.preview.warnings : [];
    const modeLabel = state.preview.mode === 'ai' ? 'Organizado com IA' : state.preview.mode === 'rules' ? 'Organizado localmente' : 'Cadastro manual';
    return `<form class="pmh-demand-preview" data-demand-preview>
      <header><div><small>PRÉVIA EDITÁVEL · ${esc(modeLabel)}</small><h3>Confirme antes de registrar</h3><p>A IA apenas estruturou a ideia. Você continua no volante.</p></div><button type="button" data-demand-cancel>×</button></header>
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

  const renderDemandCard = (item) => {
    const due = dueInfo(item);
    const done = item.steps.filter((step) => step.done).length;
    const description = item.description && item.description !== item.title ? `<p>${esc(item.description)}</p>` : '';
    return `<article class="pmh-demand-card priority-${esc(item.priority)} ${due.tone === 'late' ? 'late' : ''}" data-demand-id="${esc(item.id)}">
      <header><div><div class="pmh-demand-tags"><span class="priority">${esc(LABELS.priority[item.priority])}</span><span>${esc(LABELS.origin[item.origin])}</span>${item.category ? `<span>${esc(item.category)}</span>` : ''}</div><h4>${esc(item.title)}</h4>${description}</div><span class="pmh-demand-due ${esc(due.tone)}">${esc(due.label)}</span></header>
      <div class="pmh-demand-meta"><span><small>RESPONSÁVEL</small><strong>${esc(item.responsible || 'Não definido')}</strong></span><span><small>SOLICITADO POR</small><strong>${esc(item.requestedBy || LABELS.origin[item.origin])}</strong></span><span><small>STATUS</small><strong>${esc(LABELS.status[item.status])}</strong></span></div>
      ${item.steps.length ? `<details class="pmh-demand-steps"><summary><span>Etapas</span><b>${done}/${item.steps.length}</b></summary><div>${item.steps.map((step) => `<label class="${step.done ? 'done' : ''}"><input type="checkbox" data-demand-step="${esc(step.id)}" data-demand-id="${esc(item.id)}" ${step.done ? 'checked' : ''}><span>${esc(step.text)}</span></label>`).join('')}</div></details>` : ''}
      ${item.notes ? `<aside>${esc(item.notes)}</aside>` : ''}
      <footer><small>${item.aiMode === 'ai' ? '✨ Organizada com IA' : item.aiMode === 'rules' ? '⚙ Organizada localmente' : 'Cadastro manual'}</small><div><button type="button" data-demand-edit="${esc(item.id)}">Editar</button><button type="button" class="success" data-demand-complete="${esc(item.id)}">Concluir</button><button type="button" class="danger" data-demand-delete="${esc(item.id)}">Excluir</button></div></footer>
    </article>`;
  };

  const renderCompleted = (items) => {
    if (!items.length) return '';
    return `<details class="pmh-demand-completed"><summary><span>Demandas concluídas</span><b>${items.length}</b></summary><div>${items.map((item) => `<article><div><strong>${esc(item.title)}</strong><small>${esc(item.responsible || 'Sem responsável')} · ${esc(fmtDate(item.dueDate))}</small></div><button type="button" data-demand-reopen="${esc(item.id)}">Reabrir</button></article>`).join('')}</div></details>`;
  };

  const render = () => {
    const target = mount();
    if (!target || !state.loaded) return;
    const active = sortedActive();
    const completed = completedItems();
    const overdue = active.filter((item) => (dayDiff(item.dueDate) ?? 0) < 0).length;
    const urgent = active.filter((item) => item.priority === 'urgent').length;
    const today = active.filter((item) => dayDiff(item.dueDate) === 0).length;

    target.innerHTML = `
      <header class="pmh-demand-section-head"><div><small>DEMANDAS INTERNAS</small><h2>O que não chega pelo SULTS</h2><p>Pedidos da direção, reuniões, WhatsApp e decisões internas do Marketing.</p></div><button type="button" data-demand-manual>+ Cadastro manual</button></header>
      <section class="pmh-demand-capture">
        <div><small>DESCREVA DO SEU JEITO</small><h3>Jogue a ideia aqui. A IA organiza.</h3><p>Ex.: “A direção pediu uma campanha para os colaboradores dos shoppings ainda este mês. A Ágata faz as artes e eu aprovo.”</p></div>
        <textarea data-demand-input maxlength="4000" placeholder="Escreva a demanda como você falaria…">${esc(state.inputText)}</textarea>
        <footer><span>${esc(state.aiMessage || 'Você revisa tudo antes de salvar.')}</span><button type="button" data-demand-organize>✨ Organizar com IA</button></footer>
      </section>
      ${renderPreview()}
      <section class="pmh-demand-kpis"><article><small>ATIVAS</small><strong>${active.length}</strong><span>Demandas em aberto</span></article><article class="red"><small>ATRASADAS</small><strong>${overdue}</strong><span>Prazo já vencido</span></article><article class="orange"><small>VENCEM HOJE</small><strong>${today}</strong><span>Precisam de ação</span></article><article class="purple"><small>URGENTES</small><strong>${urgent}</strong><span>Prioridade máxima</span></article></section>
      <section class="pmh-demand-list"><header><div><small>FILA INTERNA</small><h3>Demandas confirmadas</h3></div><span>${active.length} ativas</span></header><div>${active.length ? active.map(renderDemandCard).join('') : '<div class="pmh-demand-empty"><strong>Nenhuma demanda interna ativa.</strong><span>Use o campo acima para registrar a primeira.</span></div>'}</div></section>
      ${renderCompleted(completed)}`;
  };

  const ensureMount = async () => {
    if (!isHome()) return;
    if (mount()) return;
    const hero = document.querySelector('.pmh-hero');
    if (!hero) return;
    const section = document.createElement('section');
    section.className = 'pmh-internal-demands';
    section.dataset.internalDemands = '1';
    section.innerHTML = '<div class="pmh-demand-loading">Carregando demandas internas…</div>';
    const metrics = hero.nextElementSibling;
    if (metrics) metrics.after(section);
    else hero.after(section);
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
      if (button) { button.disabled = false; button.textContent = '✨ Organizar com IA'; }
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
      state.items = state.items.filter((candidate) => candidate.id !== item.id);
      await save();
      return toast('Demanda excluída.');
    }
  });

  const observer = new MutationObserver(() => ensureMount());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  ensureMount();
})();
