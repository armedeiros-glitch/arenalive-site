(() => {
  'use strict';

  const DISPLAY_MS = 5000;
  const timers = new WeakMap();

  const armAlert = (alert) => {
    if (!(alert instanceof HTMLElement) || alert.dataset.feedbackTransient === '1') return;
    alert.dataset.feedbackTransient = '1';
    alert.setAttribute('role', 'status');
    alert.setAttribute('aria-live', 'polite');

    const timer = window.setTimeout(() => {
      alert.remove();
      timers.delete(alert);
    }, DISPLAY_MS + 120);

    timers.set(alert, timer);
  };

  const armVisibleAlerts = () => {
    document.querySelectorAll('.pmh-alert').forEach(armAlert);
  };

  window.addEventListener('pmh:view-rendered', armVisibleAlerts);
  window.addEventListener('pmh:access-ready', armVisibleAlerts);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', armVisibleAlerts, { once: true });
  } else {
    armVisibleAlerts();
  }
})();