(() => {
  'use strict';

  const API = '/api/hub/planet/leads';

  const notifyLeadRefresh = (leadId, updatedAt) => {
    const events = window.AndreOS?.events;
    if (events?.emit) {
      events.emit('notifications.updated', {
        source: 'expansion-email-contact',
        leadId,
        updatedAt,
      }, {
        dedupeKey: `expansion-email-contact:${leadId}:${updatedAt}`,
      });
    }
  };

  const recordEmailContact = async (leadId) => {
    if (!leadId) return;
    const lastActionAt = new Date().toISOString();
    try {
      const response = await fetch(API, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        cache: 'no-store',
        keepalive: true,
        body: JSON.stringify({
          id: leadId,
          changes: { status: 'contacted', lastActionAt },
        }),
      });
      if (!response.ok) return;
      notifyLeadRefresh(leadId, lastActionAt);
    } catch {
      // O mailto deve continuar abrindo mesmo se o registro do contato falhar.
    }
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('[data-lead-email]');
    if (!link) return;
    recordEmailContact(String(link.dataset.leadEmail || ''));
  }, true);

  window.PlanetExpansionContactTrail = Object.freeze({ recordEmailContact });
})();
