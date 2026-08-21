(() => {
  'use strict';

  const DESKTOP = window.matchMedia('(min-width: 821px)');

  const ensureCloseControl = () => {
    if (!DESKTOP.matches) return;
    const detail = document.querySelector('[data-inauguration-browser-detail]:not([hidden])');
    const head = detail?.querySelector('.pmh-inauguration-project-detail-head');
    if (!head || head.querySelector('[data-inauguration-project-close]')) return;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pmh-inauguration-project-close';
    close.dataset.inaugurationProjectClose = '1';
    close.setAttribute('aria-label', 'Voltar para todas as implantações');
    close.title = 'Voltar à lista';
    close.innerHTML = '<span>Voltar à lista</span><b aria-hidden="true">×</b>';
    head.appendChild(close);
  };

  const closeProject = () => {
    const browser = document.querySelector('[data-inauguration-browser-root]');
    if (!browser) return;
    const back = browser.querySelector('[data-inauguration-back]');
    if (back) {
      back.click();
      return;
    }

    const list = browser.querySelector('[data-inauguration-browser-list]');
    const detail = browser.querySelector('[data-inauguration-browser-detail]');
    const store = browser.querySelector('[data-inauguration-browser-store]');
    const card = detail?.querySelector('.pmh-inauguration-card');
    if (card && store) store.appendChild(card);
    if (detail) {
      detail.replaceChildren();
      detail.hidden = true;
    }
    if (list) list.hidden = false;
  };

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-inauguration-project-close]')) return;
    event.preventDefault();
    closeProject();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const detail = document.querySelector('[data-inauguration-browser-detail]:not([hidden])');
    if (detail) closeProject();
  });

  window.addEventListener('pmh:view-rendered', () => requestAnimationFrame(ensureCloseControl));
  window.addEventListener('hashchange', () => requestAnimationFrame(ensureCloseControl));

  const observer = new MutationObserver(() => requestAnimationFrame(ensureCloseControl));
  const start = () => observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();