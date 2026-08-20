(() => {
  'use strict';

  const TRACKED_KEY = 'planet-hub-inaugurations-v2';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const ownerFor = (action, fallback = '') => {
    const key = normalize(action);
    if (key === 'criacao/ajuste do instagram') return 'Franqueadora';
    if (key === 'criacao/ajuste do facebook') return 'Franqueadora';
    if (key === 'google meu negocio') return 'Franqueadora';
    if (key === 'video de inauguracao') return 'Franqueado';
    return String(fallback || '').trim();
  };

  const normalizeItems = (items) => (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    checklist: Array.isArray(item?.checklist)
      ? item.checklist.map((step) => ({
        ...step,
        owner: ownerFor(step?.action, step?.owner),
      }))
      : item?.checklist,
  }));

  const normalizeStore = () => {
    let current;
    try {
      current = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
    } catch (_) {
      return false;
    }
    if (!Array.isArray(current)) return false;
    const next = normalizeItems(current);
    const before = JSON.stringify(current);
    const after = JSON.stringify(next);
    if (before === after) return false;
    window.localStorage.setItem(TRACKED_KEY, after);
    return true;
  };

  const applyDom = () => {
    document.querySelectorAll('.pmh-checklist label').forEach((row) => {
      const action = row.querySelector('strong')?.textContent || '';
      const expected = ownerFor(action, '');
      if (!expected) return;

      const candidates = [...row.querySelectorAll('span, small, em')];
      const ownerNode = candidates.find((node) => /franquead/i.test(node.textContent || ''));
      if (ownerNode) ownerNode.textContent = expected;
    });
  };

  const refresh = () => {
    normalizeStore();
    requestAnimationFrame(applyDom);
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-inauguration-schedule-export]')) normalizeStore();
  }, true);

  window.addEventListener('pmh:view-rendered', (event) => {
    if (String(event.detail?.view || '') === 'inauguracoes') refresh();
  });

  window.addEventListener('storage', (event) => {
    if (event.key === TRACKED_KEY) refresh();
  });

  const observer = new MutationObserver(() => applyDom());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  refresh();

  window.PlanetInaugurationOwnerRules = Object.freeze({ ownerFor, normalizeItems });
})();
