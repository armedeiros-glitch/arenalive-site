(() => {
  'use strict';

  const ROOT_SELECTOR = '[data-radar-reliability]';
  const PAUSED_ATTRIBUTE = 'reliabilityPaused';
  let latestSnapshot = null;
  let retrying = false;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const isHome = () => normalize(document.querySelector('[data-title]')?.textContent)
    .includes('painel de marketing');

  const sourceFailed = (snapshot, label) => (snapshot?.errors || []).some((error) =>
    normalize(error).includes(normalize(label)),
  );

  const criticalFailure = (snapshot) => sourceFailed(snapshot, 'SULTS');

  const ensureStatus = () => {
    const content = document.querySelector('[data-content]');
    if (!content || !isHome()) return null;

    let status = document.querySelector(ROOT_SELECTOR);
    if (!status) {
      status = document.createElement('section');
      status.className = 'pmh-radar-reliability';
      status.dataset.radarReliability = '1';
      const alert = content.querySelector(':scope > .pmh-alert');
      if (alert?.nextSibling) content.insertBefore(status, alert.nextSibling);
      else if (alert) content.appendChild(status);
      else content.insertBefore(status, content.firstChild);
    }
    return status;
  };

  const removeStatus = () => document.querySelector(ROOT_SELECTOR)?.remove();

  const pauseCockpit = (snapshot) => {
    const cockpit = document.querySelector('[data-decision-cockpit]');
    if (!cockpit) return;

    if (!criticalFailure(snapshot)) {
      delete cockpit.dataset[PAUSED_ATTRIBUTE];
      return;
    }

    if (cockpit.dataset[PAUSED_ATTRIBUTE] === '1') return;
    cockpit.dataset[PAUSED_ATTRIBUTE] = '1';
    cockpit.innerHTML = `<div class="pmh-radar-paused">
      <div>
        <small>🛡️ RADAR EM MODO SEGURO</small>
        <h2>Não vou escolher um foco com dados incompletos</h2>
        <p>A leitura dos chamados do SULTS não terminou e ainda não existe uma cópia completa disponível para esta sessão.</p>
      </div>
      <button type="button" data-radar-retry>Tentar reconectar</button>
    </div>`;
  };

  const renderStatus = (snapshot) => {
    latestSnapshot = snapshot || latestSnapshot;
    if (!isHome()) {
      removeStatus();
      return;
    }

    const errors = Array.isArray(latestSnapshot?.errors) ? latestSnapshot.errors : [];
    if (!errors.length) {
      removeStatus();
      pauseCockpit(latestSnapshot);
      return;
    }

    const status = ensureStatus();
    if (!status) return;
    status.innerHTML = `<div>
      <span>⚠️</span>
      <div><strong>Leitura incompleta</strong><p>Falharam: ${errors.map(esc).join(', ')}. Os dados disponíveis não serão tratados como uma fotografia completa.</p></div>
    </div>
    <button type="button" data-radar-retry>${retrying ? 'Reconectando…' : 'Tentar reconectar'}</button>`;
    status.classList.toggle('is-retrying', retrying);
    pauseCockpit(latestSnapshot);
  };

  const retry = async () => {
    if (retrying) return;
    retrying = true;
    renderStatus(latestSnapshot);

    try {
      document.querySelector('[data-refresh]')?.click();
      window.PMHRadarData?.invalidate?.();
      await window.PMHRadarData?.collect?.({ force: true, maxAgeMs: 0 });
    } catch {
      // A própria faixa mantém o estado de falha e permite tentar novamente.
    } finally {
      retrying = false;
      latestSnapshot = window.PMHRadarData?.getSnapshot?.() || latestSnapshot;
      renderStatus(latestSnapshot);
    }
  };

  window.addEventListener('pmh:radar-data', (event) => renderStatus(event.detail));
  window.addEventListener('hashchange', () => setTimeout(() => renderStatus(latestSnapshot), 0));

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-radar-retry]')) return;
    event.preventDefault();
    retry();
  });

  const observer = new MutationObserver(() => {
    if (latestSnapshot && isHome()) renderStatus(latestSnapshot);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  latestSnapshot = window.PMHRadarData?.getSnapshot?.() || null;
  if (latestSnapshot) renderStatus(latestSnapshot);
})();
