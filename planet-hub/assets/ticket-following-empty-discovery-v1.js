(() => {
  'use strict';

  let armed = true;

  const shouldOpenDiscovery = ({ summary = '', hasDiscovery = false } = {}) => (
    !hasDiscovery && /^0 chamados acompanhados\b/i.test(String(summary).trim())
  );

  const sync = () => {
    const mount = document.querySelector('.pmh-ticket-command');
    const summary = document.querySelector('.pmh-section-head p')?.textContent || '';
    const discoveryList = mount?.querySelector('[data-command-discovery-list]');
    const discoveryButton = mount?.querySelector('[data-command-discovery]');

    if (/^[1-9]\d* chamados? acompanhados?\b/i.test(String(summary).trim())) armed = true;
    if (!armed || !mount || !discoveryButton) return;
    if (!shouldOpenDiscovery({ summary, hasDiscovery: Boolean(discoveryList) })) return;

    armed = false;
    discoveryButton.click();
  };

  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => {
    armed = true;
    queueMicrotask(sync);
  });

  window.TicketFollowingEmptyDiscovery = Object.freeze({ shouldOpenDiscovery });
  sync();
})();