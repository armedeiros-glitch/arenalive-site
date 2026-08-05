(() => {
  'use strict';

  const HANDOFF_KEY = 'pmh:attention-handoff:v1';
  const HANDLED_KEY = 'pmh:direct-task-opened:v1';
  const OPEN_DELAY_MS = 280;
  const WAIT_TIMEOUT_MS = 8000;

  let activeToken = '';

  const readJson = (key) => {
    try {
      return JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  };

  const readHandoff = () => {
    const value = readJson(HANDOFF_KEY);
    return value?.itemId ? value : null;
  };

  const tokenFor = (handoff) => `${handoff?.itemId || ''}:${handoff?.createdAt || ''}`;
  const currentView = () => {
    const value = String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();
    if (value.includes('cham')) return 'chamados';
    if (value.includes('inaug')) return 'inauguracoes';
    if (value.includes('calend') || value.includes('campanha')) return 'calendario';
    if (value.includes('conte')) return 'conteudos';
    return 'inicio';
  };
  const targetView = (action) => action === 'demand' ? 'inicio' : String(action || 'inicio');
  const sourceIdOf = (handoff) => String(handoff?.sourceId || handoff?.itemId || '')
    .replace(/^(?:ticket|demand|content|campaign|inauguration)-/, '');
  const cssValue = (value) => window.CSS?.escape
    ? window.CSS.escape(String(value || ''))
    : String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

  const waitForSelector = (selector, timeoutMs = WAIT_TIMEOUT_MS) => new Promise((resolve) => {
    const immediate = document.querySelector(selector);
    if (immediate) return resolve(immediate);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
      resolve(value || null);
    };
    const observer = new MutationObserver(() => {
      const target = document.querySelector(selector);
      if (target) finish(target);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    const timeout = setTimeout(() => finish(null), timeoutMs);
  });

  const waitForView = (view, timeoutMs = WAIT_TIMEOUT_MS) => new Promise((resolve) => {
    if (currentView() === view && document.querySelector('[data-content]')) return resolve(true);

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener('pmh:view-rendered', onView);
      resolve(Boolean(value));
    };
    const onView = (event) => {
      if (String(event.detail?.view || '') === view) finish(true);
    };
    window.addEventListener('pmh:view-rendered', onView);
    const timeout = setTimeout(() => finish(false), timeoutMs);
  });

  const routeTo = async (view) => {
    if (currentView() === view) return true;
    const trigger = [...document.querySelectorAll(`[data-view="${cssValue(view)}"]`)]
      .find((element) => !element.closest('[data-decision-cockpit], [data-attention-handoff]'));
    if (!trigger) return false;
    trigger.click();
    return waitForView(view);
  };

  const markTarget = (element) => {
    if (!element) return false;
    element.classList.add('pmh-attention-target');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
    element.focus?.({ preventScroll: true });
    setTimeout(() => element.classList.remove('pmh-attention-target'), 3200);
    return true;
  };

  const openTicket = async (handoff) => {
    const id = sourceIdOf(handoff);
    if (!id) return false;
    const currentDrawer = document.querySelector('.pmh-ticket-drawer');
    if (currentDrawer && currentDrawer.textContent.includes(`#${id}`)) return true;

    const proxy = document.createElement('article');
    proxy.className = 'pmh-ticket';
    proxy.dataset.ticketId = id;
    proxy.hidden = true;
    document.body.appendChild(proxy);
    proxy.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    proxy.remove();

    const drawer = await waitForSelector('.pmh-ticket-drawer', 3000);
    return Boolean(drawer && drawer.textContent.includes(`#${id}`));
  };

  const openDemand = async (handoff) => {
    const id = sourceIdOf(handoff);
    const selector = `[data-demand-edit="${cssValue(id)}"]`;
    let target = document.querySelector(selector);
    if (!target) {
      document.querySelector('[data-active-filter="all"]')?.click();
      target = await waitForSelector(selector);
    }
    if (!target) return false;
    target.click();
    return Boolean(await waitForSelector('[data-demand-preview]', 3000));
  };

  const openContent = async (handoff) => {
    const id = sourceIdOf(handoff);
    const selector = `[data-content-edit="${cssValue(id)}"]`;
    let target = document.querySelector(selector);
    if (!target) {
      const clear = await waitForSelector('[data-content-clear]');
      clear?.click();
      target = await waitForSelector(selector);
    }
    if (!target) return false;
    target.click();
    return Boolean(await waitForSelector('.pmh-assets-modal', 3000));
  };

  const openCampaign = async (handoff) => {
    const id = sourceIdOf(handoff);
    const target = await waitForSelector(`[data-edit-campaign="${cssValue(id)}"]`);
    if (!target) return false;
    target.click();
    return Boolean(await waitForSelector('.pmh-campaign-modal', 3000));
  };

  const openInauguration = async (handoff) => {
    const id = sourceIdOf(handoff);
    const workspace = await waitForSelector(`[data-inauguration-workspace="${cssValue(id)}"]`);
    if (!workspace) return false;
    const pending = [...workspace.querySelectorAll('.pmh-checklist label')]
      .find((label) => !label.querySelector('input')?.checked);
    return markTarget(pending || workspace);
  };

  const OPENERS = {
    chamados: openTicket,
    demand: openDemand,
    conteudos: openContent,
    calendario: openCampaign,
    inauguracoes: openInauguration,
  };

  const markHandled = (token) => {
    try {
      sessionStorage.setItem(HANDLED_KEY, token);
    } catch {
      // A abertura continua válida sem persistir o controle de duplicidade.
    }
  };

  const openCurrentHandoff = async () => {
    const handoff = readHandoff();
    const token = tokenFor(handoff);
    if (!handoff || !token || token === activeToken || readJson(HANDLED_KEY) === token) return;

    activeToken = token;
    await sleep(OPEN_DELAY_MS);

    try {
      const view = targetView(handoff.action);
      if (!await routeTo(view)) return;
      const opener = OPENERS[handoff.action];
      const opened = opener ? await opener(handoff) : false;
      if (opened) markHandled(token);
    } finally {
      activeToken = '';
    }
  };

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-attention-open], [data-attention-reopen]')) return;
    queueMicrotask(openCurrentHandoff);
  }, true);
})();
