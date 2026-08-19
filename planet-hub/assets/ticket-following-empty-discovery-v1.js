(() => {
  'use strict';

  let armed = true;

  const shouldOpenDiscovery = ({ summary = '', hasDiscovery = false } = {}) => (
    !hasDiscovery && /^0 chamados acompanhados\b/i.test(String(summary).trim())
  );

  const syncPresentation = (mount, discoveryList) => {
    if (!mount) return;
    const metrics = mount.querySelector('.pmh-command-metrics');
    const head = document.querySelector('.pmh-section-head');
    const active = Boolean(discoveryList);
    const decorated = mount.dataset.emptyDiscovery === '1';

    if (active && !decorated) {
      mount.dataset.emptyDiscovery = '1';
      if (metrics) metrics.hidden = true;
      if (head) head.innerHTML = '<div><small>SELEÇÃO INICIAL</small><h2>Escolha os chamados que quer acompanhar</h2><p>Estes são os chamados ativos do SULTS. Adicione somente os que devem ficar na sua fila do André OS.</p></div>';
      return;
    }

    if (!active && decorated) {
      delete mount.dataset.emptyDiscovery;
      if (metrics) metrics.hidden = false;
    }
  };

  const sync = () => {
    const mount = document.querySelector('.pmh-ticket-command');
    const summary = document.querySelector('.pmh-section-head p')?.textContent || '';
    const discoveryList = mount?.querySelector('[data-command-discovery-list]');
    const discoveryButton = mount?.querySelector('[data-command-discovery]');

    syncPresentation(mount, discoveryList);

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