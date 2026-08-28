(() => {
  const STORAGE_KEY = 'planet-hub-implantations-v1';
  const SULTS_API_URL = '/api/sults/implantacoes?start=0&limit=100&scope=operational';
  let lastFocus = null;
  let sultsItems = [];
  let sultsState = 'loading';

  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  };

  const write = (items) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

  const modal = document.createElement('div');
  modal.className = 'pmh-implant-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <section class="pmh-implant-dialog" role="dialog" aria-modal="true" aria-labelledby="pmh-implant-title">
      <header class="pmh-implant-head">
        <div><small>NOVA UNIDADE NO RADAR</small><h2 id="pmh-implant-title">Nova implantação</h2></div>
        <button class="pmh-implant-close" type="button" aria-label="Fechar">×</button>
      </header>
      <form class="pmh-implant-form">
        <div class="pmh-implant-grid">
          <label>Nome da unidade<input name="unit" required placeholder="Ex.: Planet Chocolate Joinville"></label>
          <label>Franqueado(a)<input name="franchisee" required placeholder="Nome do responsável"></label>
          <label>Cidade / UF<input name="location" required placeholder="Ex.: Joinville / SC"></label>
          <label>Data prevista da inauguração<input name="openingDate" required type="date"></label>
          <label>Orçamento da inauguração<input name="budget" inputmode="decimal" placeholder="Ex.: 5500"></label>
        </div>
        <p class="pmh-implant-note">Ao salvar, a unidade entra com o checklist de 15 etapas do Marketing e o pacote das 6 ações exclusivas da inauguração.</p>
        <footer class="pmh-implant-actions">
          <button class="pmh-implant-cancel" type="button">Cancelar</button>
          <button class="pmh-implant-save" type="submit">Criar implantação</button>
        </footer>
      </form>
    </section>`;
  document.body.appendChild(modal);

  const form = modal.querySelector('form');
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  };
  const open = (trigger) => {
    lastFocus = trigger;
    form.reset();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => form.elements.unit.focus());
  };

  modal.querySelector('.pmh-implant-close').addEventListener('click', close);
  modal.querySelector('.pmh-implant-cancel').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) close(); });

  const isNewImplantationButton = (element) => {
    const button = element.closest && element.closest('button');
    if (!button) return null;
    const text = button.textContent.toLowerCase().replace(/\s+/g, ' ').trim();
    return /nova (implanta|inaugura)/.test(text) ? button : null;
  };

  document.addEventListener('click', (event) => {
    const button = isNewImplantationButton(event.target);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(button);
  }, true);

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));

  const formatDate = (value) => {
    if (!value) return 'Data não informada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
  };

  const isPastDate = (value) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date.getTime() < today.getTime();
  };

  const statusLabel = (item) => {
    if (item.completed) return 'CONCLUÍDO';
    if (item.paused) return 'PAUSADO';
    if (item.overdue) return 'ATRASADO NO SULTS';
    if (item.active) return 'EM IMPLANTAÇÃO';
    return 'INATIVO';
  };

  const normalizeSultsItem = (item) => ({
    id: `sults-${item.sultsProjectId}`,
    source: 'sults',
    unit: item.unit,
    franchisee: item.responsible || 'Responsável não informado',
    location: item.category || item.model || 'Localização não informada',
    openingDate: item.endDate || item.startDate,
    completed: item.completed,
    paused: item.paused,
    active: item.active,
    overdue: !item.completed && !item.paused && item.active && isPastDate(item.endDate),
    cnpj: item.cnpj,
    projectName: item.projectName,
  });

  const render = () => {
    const title = [...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'Inaugurações');
    if (!title) return;
    const page = title.closest('div[class]');
    const overview = page && [...page.children].find((node) => node.tagName === 'SECTION' && !node.querySelector('h2'));
    if (!overview) return;

    let list = page.querySelector('.pmh-implant-list');
    const localItems = read();
    const items = [...sultsItems.map(normalizeSultsItem), ...localItems];

    if (!items.length && sultsState !== 'loading' && sultsState !== 'error') {
      if (list) list.remove();
      return;
    }

    if (!list) {
      list = document.createElement('section');
      list.className = 'pmh-implant-list';
      overview.parentNode.insertBefore(list, overview);
    }

    if (sultsState === 'loading' && !items.length) {
      list.innerHTML = '<header><h3>Implantações cadastradas</h3><span>Sincronizando com o SULTS…</span></header>';
      return;
    }

    const syncMessage = sultsState === 'error'
      ? '<p class="pmh-implant-note">Não foi possível sincronizar com o SULTS agora. As implantações manuais continuam disponíveis.</p>'
      : '';

    const markup = `<header><h3>Implantações em acompanhamento</h3><span>${items.length} ${items.length === 1 ? 'unidade' : 'unidades'}</span></header>${syncMessage}` +
      items.map((item) => `<article class="pmh-implant-card">
        <div><small>${item.source === 'sults' ? statusLabel(item) : 'EM IMPLANTAÇÃO'}</small><h4>${escapeHtml(item.unit)}</h4><p>${escapeHtml(item.location)} · Responsável: ${escapeHtml(item.franchisee)}</p></div>
        <aside><strong>${item.source === 'sults' ? 'Fim previsto ' : 'Inauguração '}${formatDate(item.openingDate)}</strong><span>${item.source === 'sults' ? 'Sincronizado com o SULTS' : '0/15 etapas · 6 ações inaugurais'}</span></aside>
      </article>`).join('');

    if (list.innerHTML !== markup) list.innerHTML = markup;
  };

  const loadSults = async () => {
    sultsState = 'loading';
    render();

    try {
      const response = await fetch(SULTS_API_URL, { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Falha na sincronização');
      sultsItems = Array.isArray(payload.data) ? payload.data : [];
      sultsState = 'ready';
    } catch (error) {
      console.error('Planet Hub: erro ao consultar o SULTS', error);
      sultsItems = [];
      sultsState = 'error';
    }

    render();
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const items = read();
    items.unshift({
      id: `implant-${Date.now()}`,
      source: 'manual',
      unit: data.get('unit').trim(),
      franchisee: data.get('franchisee').trim(),
      location: data.get('location').trim(),
      openingDate: data.get('openingDate'),
      budget: data.get('budget').trim(),
      createdAt: new Date().toISOString(),
      checklistDone: [],
      inauguralActions: []
    });
    write(items);
    close();
    render();
  });

  const observer = new MutationObserver(render);
  observer.observe(document.getElementById('root'), { childList: true, subtree: true });
  render();
  loadSults();
})();
