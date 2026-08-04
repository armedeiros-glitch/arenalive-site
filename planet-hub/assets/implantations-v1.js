(() => {
  const STORAGE_KEY = 'planet-hub-implantations-v1';
  let lastFocus = null;

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

  const formatDate = (value) => {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };

  const render = () => {
    const title = [...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'Inaugurações');
    if (!title) return;
    const page = title.closest('div[class]');
    const overview = page && [...page.children].find((node) => node.tagName === 'SECTION' && !node.querySelector('h2'));
    if (!overview) return;
    let list = page.querySelector('.pmh-implant-list');
    const items = read();
    if (!items.length) {
      if (list) list.remove();
      return;
    }
    if (!list) {
      list = document.createElement('section');
      list.className = 'pmh-implant-list';
      overview.parentNode.insertBefore(list, overview);
    }
    const markup = `<header><h3>Implantações cadastradas</h3><span>${items.length} ${items.length === 1 ? 'unidade' : 'unidades'}</span></header>` +
      items.map((item) => `<article class="pmh-implant-card">
        <div><small>EM IMPLANTAÇÃO</small><h4>${escapeHtml(item.unit)}</h4><p>${escapeHtml(item.location)} · Franqueado(a): ${escapeHtml(item.franchisee)}</p></div>
        <aside><strong>Inauguração ${formatDate(item.openingDate)}</strong><span>0/15 etapas · 6 ações inaugurais</span></aside>
      </article>`).join('');
    if (list.innerHTML !== markup) list.innerHTML = markup;
  };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const items = read();
    items.unshift({
      id: `implant-${Date.now()}`,
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
})();
