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
    if (key === 'contratar influenciadores') return 'Franqueadora';
    if (key === 'contratar social media para inauguracao') return 'Franqueadora';
    if (key === 'contratar ornamentacao / arco de bolas') return 'Franqueadora';
    if (key === 'enviar @ dos influenciadores') return 'Franqueado';
    if (key === 'enviar nomes/@ e contatos dos influenciadores locais') return 'Franqueado';
    if (key === 'enviar contato/indicacao de social media local') return 'Franqueado';
    if (key === 'enviar contato/empresa de ornamentacao / arco de bolas') return 'Franqueado';
    return String(fallback || '').trim();
  };

  const canonicalAction = (action) => {
    const key = normalize(action);
    if (key === 'enviar @ dos influenciadores') return 'Enviar nomes/@ e contatos dos influenciadores locais';
    return String(action || '').trim();
  };

  const insertBefore = (checklist, targetAction, step) => {
    const exists = checklist.some((item) => normalize(item?.action) === normalize(step.action));
    if (exists) return checklist;
    const targetIndex = checklist.findIndex((item) => normalize(item?.action) === normalize(targetAction));
    if (targetIndex < 0) return [...checklist, step];
    return [...checklist.slice(0, targetIndex), step, ...checklist.slice(targetIndex)];
  };

  const normalizeChecklist = (checklist) => {
    let next = (Array.isArray(checklist) ? checklist : []).map((step) => {
      const action = canonicalAction(step?.action);
      return {
        ...step,
        action,
        owner: ownerFor(action, step?.owner),
      };
    });

    next = insertBefore(next, 'Contratar influenciadores', {
      action: 'Enviar nomes/@ e contatos dos influenciadores locais',
      owner: 'Franqueado',
      daysBefore: 20,
      done: false,
    });
    next = insertBefore(next, 'Contratar Social Media para inauguração', {
      action: 'Enviar contato/indicação de Social Media local',
      owner: 'Franqueado',
      daysBefore: 20,
      done: false,
    });
    next = insertBefore(next, 'Contratar ornamentação / arco de bolas', {
      action: 'Enviar contato/empresa de ornamentação / arco de bolas',
      owner: 'Franqueado',
      daysBefore: 20,
      done: false,
    });

    return next;
  };

  const normalizeItems = (items) => (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    checklist: Array.isArray(item?.checklist)
      ? normalizeChecklist(item.checklist)
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

  const ensureStyles = () => {
    if (document.querySelector('style[data-inauguration-owner-colors]')) return;
    const style = document.createElement('style');
    style.dataset.inaugurationOwnerColors = '1';
    style.textContent = `
      .pmh-checklist-owner-legend{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;padding:8px 10px;border:1px solid var(--os-border);border-radius:10px;background:var(--os-surface-subtle);color:var(--os-text-muted);font-size:10px;font-weight:800}
      .pmh-checklist-owner-legend span{display:inline-flex;align-items:center;gap:6px}
      .pmh-checklist-owner-legend i{width:8px;height:8px;border-radius:999px;display:inline-block}
      .pmh-checklist-owner-legend .franqueadora i{background:#f47c20}
      .pmh-checklist-owner-legend .franqueado i{background:#6f7f95}
      .pmh-checklist label[data-owner-scope="franqueadora"]{box-shadow:inset 3px 0 0 #f47c20;background:rgba(244,124,32,.055)}
      .pmh-checklist label[data-owner-scope="franqueado"]{box-shadow:inset 3px 0 0 #6f7f95;background:rgba(111,127,149,.055)}
      .pmh-checklist-owner-badge{display:inline-flex!important;align-items:center;min-height:22px;padding:2px 8px;border-radius:999px;font-size:9px!important;font-weight:900!important;letter-spacing:.02em}
      .pmh-checklist-owner-badge.owner-franqueadora{color:#9a4300!important;background:rgba(244,124,32,.14)!important}
      .pmh-checklist-owner-badge.owner-franqueado{color:#536174!important;background:rgba(111,127,149,.15)!important}
    `;
    document.head?.appendChild(style);
  };

  const applyDom = () => {
    ensureStyles();
    document.querySelectorAll('.pmh-checklist').forEach((checklist) => {
      if (!checklist.querySelector(':scope > .pmh-checklist-owner-legend')) {
        const legend = document.createElement('div');
        legend.className = 'pmh-checklist-owner-legend';
        legend.innerHTML = '<span class="franqueadora"><i></i>Franqueadora</span><span class="franqueado"><i></i>Franqueado</span>';
        checklist.prepend(legend);
      }
    });

    document.querySelectorAll('.pmh-checklist label').forEach((row) => {
      const actionNode = row.querySelector('strong');
      if (!actionNode) return;
      const canonical = canonicalAction(actionNode.textContent || '');
      if (canonical && actionNode.textContent !== canonical) actionNode.textContent = canonical;

      const expected = ownerFor(canonical, '');
      const candidates = [...row.querySelectorAll('span, small, em')];
      const ownerNode = candidates.find((node) => /franquead/i.test(node.textContent || ''));

      row.removeAttribute('data-owner-scope');
      if (ownerNode) {
        ownerNode.classList.remove('pmh-checklist-owner-badge', 'owner-franqueadora', 'owner-franqueado');
      }
      if (!expected || !ownerNode) return;

      if (ownerNode.textContent !== expected) ownerNode.textContent = expected;
      const scope = normalize(expected) === 'franqueadora' ? 'franqueadora' : 'franqueado';
      row.dataset.ownerScope = scope;
      ownerNode.classList.add('pmh-checklist-owner-badge', `owner-${scope}`);
    });
  };

  const refresh = () => {
    normalizeStore();
    requestAnimationFrame(applyDom);
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-inauguration-schedule-export]')) normalizeStore();
    if (event.target.closest?.('[data-inauguration-open], [data-inauguration-browser-detail], [data-inauguration-workspace], [data-inauguration-tab="checklist"]')) {
      requestAnimationFrame(applyDom);
    }
  }, true);

  window.addEventListener('pmh:view-rendered', (event) => {
    if (String(event.detail?.view || '') === 'inauguracoes') refresh();
  });

  window.addEventListener('storage', (event) => {
    if (event.key === TRACKED_KEY) refresh();
  });

  refresh();

  window.PlanetInaugurationOwnerRules = Object.freeze({ ownerFor, normalizeItems, normalizeChecklist });
})();
