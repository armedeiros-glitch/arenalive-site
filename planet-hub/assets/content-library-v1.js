(() => {
  'use strict';

  const API = '/api/hub/conteudos';
  const LOCAL_KEY = 'planet-hub:conteudos:v1';

  const STATUS = {
    planejamento: 'Planejamento',
    producao: 'Em produção',
    aprovacao: 'Em aprovação',
    publicado: 'Publicado',
    arquivado: 'Arquivado',
  };

  const CATEGORIES = [
    'Campanha',
    'Inauguração',
    'Produto / Cardápio',
    'Social Media',
    'Treinamento',
    'Institucional',
    'Manual / Marca',
    'Apresentação',
    'Outro',
  ];

  const FORMATS = [
    'Arte',
    'Vídeo',
    'PDF',
    'Apresentação',
    'Documento',
    'Link',
    'Pasta',
    'Outro',
  ];

  const state = {
    data: null,
    revision: null,
    shared: false,
    loading: null,
    mount: null,
    head: null,
    filters: {
      search: '',
      category: '',
      status: '',
      campaign: '',
      unit: '',
    },
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const readLocal = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeLocal = () => localStorage.setItem(LOCAL_KEY, JSON.stringify(state.data || []));

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

  const mergeData = (remote, local) => {
    const map = new Map();
    [...remote, ...local].forEach((item) => {
      const id = String(item?.id || '');
      if (!id) return;
      const current = map.get(id);
      if (!current || Date.parse(item.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) {
        map.set(id, item);
      }
    });
    return [...map.values()];
  };

  const load = async () => {
    if (Array.isArray(state.data)) return state.data;
    if (state.loading) return state.loading;

    state.loading = (async () => {
      const local = readLocal();
      try {
        const payload = await apiJson(API);
        state.data = mergeData(payload.data || [], local);
        state.revision = payload.revision || null;
        state.shared = true;
        writeLocal();
        if (JSON.stringify(payload.data || []) !== JSON.stringify(state.data)) {
          await save(false);
        }
      } catch {
        state.data = local;
        state.shared = false;
      }
      return state.data;
    })().finally(() => { state.loading = null; });

    return state.loading;
  };

  const save = async (rerender = true) => {
    writeLocal();
    try {
      const payload = await apiJson(API, {
        method: 'PUT',
        body: JSON.stringify({ data: state.data, baseRevision: state.revision }),
      });
      state.data = payload.data || state.data;
      state.revision = payload.revision || state.revision;
      state.shared = true;
      writeLocal();
    } catch (error) {
      if (error.status === 409 && error.payload?.data) {
        state.data = mergeData(error.payload.data, state.data || []);
        state.revision = error.payload.revision || null;
        return save(rerender);
      }
      state.shared = false;
      throw error;
    }
    if (rerender) render();
  };

  const fmtDate = (value) => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return 'Sem atualização';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

  const uniqueSorted = (items) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

  const safeUrl = (value) => {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
      return '';
    }
  };

  const filtered = () => {
    const query = normalize(state.filters.search);
    return [...(state.data || [])]
      .filter((item) => {
        if (state.filters.category && item.category !== state.filters.category) return false;
        if (state.filters.status && item.status !== state.filters.status) return false;
        if (state.filters.campaign && item.campaign !== state.filters.campaign) return false;
        if (state.filters.unit && item.unit !== state.filters.unit) return false;
        if (!query) return true;
        const haystack = normalize([
          item.title,
          item.description,
          item.category,
          item.format,
          item.campaign,
          item.unit,
          item.responsible,
          item.notes,
          ...(Array.isArray(item.tags) ? item.tags : []),
        ].join(' '));
        return haystack.includes(query);
      })
      .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
  };

  const options = (items, selected, placeholder) => [
    `<option value="">${esc(placeholder)}</option>`,
    ...items.map((item) => `<option value="${esc(item)}" ${item === selected ? 'selected' : ''}>${esc(item)}</option>`),
  ].join('');

  const card = (item) => {
    const url = safeUrl(item.url);
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return `<article class="pmh-asset-card status-${esc(item.status)}">
      <header>
        <div><small>${esc(item.category || 'Outro')} · ${esc(item.format || 'Link')}</small><h3>${esc(item.title || 'Conteúdo sem título')}</h3></div>
        <span>${esc(STATUS[item.status] || item.status)}</span>
      </header>
      <p>${esc(item.description || 'Sem descrição.')}</p>
      <dl>
        <div><dt>Campanha</dt><dd>${esc(item.campaign || 'Não vinculada')}</dd></div>
        <div><dt>Unidade</dt><dd>${esc(item.unit || 'Rede / geral')}</dd></div>
        <div><dt>Responsável</dt><dd>${esc(item.responsible || 'Não definido')}</dd></div>
        <div><dt>Atualizado</dt><dd>${esc(fmtDate(item.updatedAt))}</dd></div>
      </dl>
      ${tags.length ? `<div class="pmh-asset-tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
      <footer>
        <button type="button" data-content-edit="${esc(item.id)}">Editar</button>
        ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir material ↗</a>` : '<span class="pmh-asset-no-link">Sem link</span>'}
        <button type="button" class="danger" data-content-delete="${esc(item.id)}">Excluir</button>
      </footer>
    </article>`;
  };

  const render = () => {
    if (!state.mount?.isConnected || !Array.isArray(state.data)) return;

    const visible = filtered();
    const active = state.data.filter((item) => item.status !== 'arquivado');
    const production = active.filter((item) => item.status === 'producao').length;
    const approval = active.filter((item) => item.status === 'aprovacao').length;
    const published = active.filter((item) => item.status === 'publicado').length;
    const campaigns = uniqueSorted(state.data.map((item) => item.campaign));
    const units = uniqueSorted(state.data.map((item) => item.unit));

    if (state.head) {
      state.head.innerHTML = `<div><small>BIBLIOTECA DO MARKETING</small><h2>Conteúdos e materiais da operação</h2><p>Centralize links, campanhas, unidades, responsáveis e o status de cada material.</p></div><button class="primary" type="button" data-content-new>+ Novo conteúdo</button>`;
    }

    state.mount.innerHTML = `
      <section class="pmh-assets-metrics">
        <article><small>CONTEÚDOS ATIVOS</small><strong>${active.length}</strong><span>${state.shared ? 'Dados compartilhados' : 'Salvos neste navegador'}</span></article>
        <article><small>EM PRODUÇÃO</small><strong>${production}</strong><span>Materiais sendo criados</span></article>
        <article><small>EM APROVAÇÃO</small><strong>${approval}</strong><span>Aguardando validação</span></article>
        <article><small>PUBLICADOS</small><strong>${published}</strong><span>Materiais finalizados</span></article>
      </section>

      <section class="pmh-assets-filters">
        <label class="search"><span>Buscar</span><input type="search" data-content-filter="search" value="${esc(state.filters.search)}" placeholder="Título, campanha, unidade ou tag"></label>
        <label><span>Categoria</span><select data-content-filter="category">${options(CATEGORIES, state.filters.category, 'Todas')}</select></label>
        <label><span>Status</span><select data-content-filter="status"><option value="">Todos</option>${Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${state.filters.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
        <label><span>Campanha</span><select data-content-filter="campaign">${options(campaigns, state.filters.campaign, 'Todas')}</select></label>
        <label><span>Unidade</span><select data-content-filter="unit">${options(units, state.filters.unit, 'Todas')}</select></label>
        <button type="button" data-content-clear>Limpar</button>
      </section>

      <section class="pmh-assets-list-head"><div><small>ACERVO</small><h3>${visible.length} ${visible.length === 1 ? 'material encontrado' : 'materiais encontrados'}</h3></div><span>Arquivos continuam no Drive, Canva, YouTube ou origem informada.</span></section>
      <section class="pmh-assets-grid">${visible.length ? visible.map(card).join('') : '<div class="pmh-assets-empty"><strong>Nenhum conteúdo encontrado.</strong><span>Cadastre o primeiro material ou ajuste os filtros.</span></div>'}</section>`;
  };

  const toast = (message, tone = 'success') => {
    document.querySelector('.pmh-assets-toast')?.remove();
    const element = document.createElement('div');
    element.className = `pmh-assets-toast ${tone}`;
    element.textContent = message;
    document.body.appendChild(element);
    requestAnimationFrame(() => element.classList.add('visible'));
    setTimeout(() => {
      element.classList.remove('visible');
      setTimeout(() => element.remove(), 220);
    }, 2600);
  };

  const closeModal = () => document.querySelector('.pmh-assets-modal')?.remove();

  const openModal = (existing = null) => {
    const item = existing || {
      id: `content-${crypto.randomUUID()}`,
      title: '',
      description: '',
      category: 'Campanha',
      format: 'Arte',
      status: 'planejamento',
      campaign: '',
      unit: '',
      responsible: '',
      url: '',
      tags: [],
      notes: '',
      createdAt: new Date().toISOString(),
    };

    closeModal();
    const modal = document.createElement('div');
    modal.className = 'pmh-assets-modal';
    modal.innerHTML = `<section>
      <header><div><small>${existing ? 'EDITAR CONTEÚDO' : 'NOVO CONTEÚDO'}</small><h2>${existing ? esc(item.title) : 'Cadastrar material'}</h2><p>O Hub guarda a organização e o link. O arquivo continua na plataforma de origem.</p></div><button type="button" data-content-close>×</button></header>
      <form>
        <label class="wide">Título<input name="title" maxlength="220" required value="${esc(item.title)}"></label>
        <label class="wide">Descrição<textarea name="description" maxlength="700">${esc(item.description || '')}</textarea></label>
        <label>Categoria<select name="category">${CATEGORIES.map((value) => `<option value="${esc(value)}" ${item.category === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>
        <label>Formato<select name="format">${FORMATS.map((value) => `<option value="${esc(value)}" ${item.format === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>
        <label>Status<select name="status">${Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
        <label>Responsável<input name="responsible" maxlength="160" value="${esc(item.responsible || '')}"></label>
        <label>Campanha<input name="campaign" maxlength="180" value="${esc(item.campaign || '')}" placeholder="Ex.: Páscoa Planet"></label>
        <label>Unidade<input name="unit" maxlength="180" value="${esc(item.unit || '')}" placeholder="Vazio para rede inteira"></label>
        <label class="wide">Link do material<input name="url" type="url" maxlength="1200" value="${esc(item.url || '')}" placeholder="https://drive.google.com/... ou https://www.canva.com/..."></label>
        <label class="wide">Tags<input name="tags" maxlength="600" value="${esc((item.tags || []).join(', '))}" placeholder="feed, stories, inauguração, vídeo"></label>
        <label class="wide">Observações<textarea name="notes" maxlength="1600">${esc(item.notes || '')}</textarea></label>
        <footer class="wide"><span>${state.shared ? 'Será compartilhado com os demais acessos.' : 'Será salvo neste navegador.'}</span><button type="button" data-content-close>Cancelar</button><button class="primary" type="submit">Salvar conteúdo</button></footer>
      </form>
    </section>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-content-close]').forEach((button) => button.addEventListener('click', closeModal));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = 'Salvando…';

      const updated = {
        ...item,
        title: String(form.get('title') || '').trim(),
        description: String(form.get('description') || '').trim(),
        category: String(form.get('category') || 'Outro'),
        format: String(form.get('format') || 'Link'),
        status: String(form.get('status') || 'planejamento'),
        responsible: String(form.get('responsible') || '').trim(),
        campaign: String(form.get('campaign') || '').trim(),
        unit: String(form.get('unit') || '').trim(),
        url: String(form.get('url') || '').trim(),
        tags: String(form.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
        notes: String(form.get('notes') || '').trim(),
        updatedAt: new Date().toISOString(),
      };

      const index = state.data.findIndex((candidate) => candidate.id === updated.id);
      if (index >= 0) state.data[index] = updated;
      else state.data.unshift(updated);

      try {
        await save(false);
        closeModal();
        render();
        toast(state.shared ? 'Conteúdo salvo e compartilhado.' : 'Conteúdo salvo neste navegador.');
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Salvar conteúdo';
        toast(error instanceof Error ? error.message : 'Não foi possível salvar.', 'error');
      }
    });
  };

  const transform = async () => {
    const legacy = document.querySelector('.pmh-library');
    if (!legacy || legacy.dataset.contentTransforming === '1') return;
    const pageTitle = document.querySelector('[data-title]')?.textContent || '';
    if (!normalize(pageTitle).includes('conteudos')) return;

    legacy.dataset.contentTransforming = '1';
    state.head = legacy.previousElementSibling?.classList.contains('pmh-section-head')
      ? legacy.previousElementSibling
      : document.querySelector('.pmh-section-head');

    const mount = document.createElement('section');
    mount.className = 'pmh-assets-library';
    mount.innerHTML = '<div class="pmh-assets-loading">Carregando biblioteca de conteúdos…</div>';
    legacy.replaceWith(mount);
    state.mount = mount;

    await load();
    render();
  };

  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-content-filter="search"]');
    if (!input) return;
    state.filters.search = input.value;
    render();
  });

  document.addEventListener('change', (event) => {
    const filter = event.target.closest('[data-content-filter]');
    if (!filter || filter.dataset.contentFilter === 'search') return;
    state.filters[filter.dataset.contentFilter] = filter.value;
    render();
  });

  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-content-new]')) {
      openModal();
      return;
    }

    const edit = event.target.closest('[data-content-edit]');
    if (edit) {
      const item = state.data.find((candidate) => candidate.id === edit.dataset.contentEdit);
      if (item) openModal(item);
      return;
    }

    const remove = event.target.closest('[data-content-delete]');
    if (remove) {
      const item = state.data.find((candidate) => candidate.id === remove.dataset.contentDelete);
      if (!item || !window.confirm(`Excluir “${item.title}” da biblioteca?\n\nO arquivo original não será apagado.`)) return;
      state.data = state.data.filter((candidate) => candidate.id !== item.id);
      try {
        await save(false);
        render();
        toast('Conteúdo removido da biblioteca.');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Não foi possível excluir.', 'error');
      }
      return;
    }

    if (event.target.closest('[data-content-clear]')) {
      state.filters = { search: '', category: '', status: '', campaign: '', unit: '' };
      render();
    }
  });

  const observer = new MutationObserver(transform);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  transform();
})();
