(() => {
  'use strict';

  const VISIBLE_INTERVAL_MS = 60 * 1000;
  const MIN_REFRESH_GAP_MS = 40 * 1000;
  const START_DELAY_MS = 700;

  let timer = 0;
  let running = false;
  let lastRefreshAt = 0;

  const radar = () => window.PMHRadarData;
  const isVisible = () => document.visibilityState === 'visible';
  const isOnline = () => navigator.onLine !== false;
  const serviceReady = () => Boolean(radar()?.collect);
  const canRun = () => isVisible() && isOnline() && serviceReady();

  const clearTimer = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = 0;
  };

  const schedule = (delay = VISIBLE_INTERVAL_MS) => {
    clearTimer();
    if (!canRun()) return;
    timer = window.setTimeout(() => refresh(), delay);
  };

  const refresh = async ({ immediate = false } = {}) => {
    clearTimer();
    if (!canRun() || running) return;

    const elapsed = Date.now() - lastRefreshAt;
    if (!immediate && elapsed < MIN_REFRESH_GAP_MS) {
      schedule(MIN_REFRESH_GAP_MS - elapsed);
      return;
    }

    running = true;
    lastRefreshAt = Date.now();

    try {
      radar().invalidate();
      await radar().collect({ force: true });
    } catch {
      // A fila já apresenta falhas de fonte. O vigia não cria alertas repetidos.
    } finally {
      running = false;
      schedule();
    }
  };

  const wake = () => {
    if (!canRun()) return clearTimer();
    refresh({ immediate: Date.now() - lastRefreshAt >= MIN_REFRESH_GAP_MS });
  };

  document.addEventListener('visibilitychange', () => {
    if (isVisible()) wake();
    else clearTimer();
  });

  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  window.addEventListener('offline', clearTimer);
  window.addEventListener('pageshow', wake);
  window.addEventListener('pagehide', clearTimer);

  const bootstrap = () => {
    if (!serviceReady()) {
      window.setTimeout(bootstrap, START_DELAY_MS);
      return;
    }
    if (canRun()) wake();
  };

  window.setTimeout(bootstrap, START_DELAY_MS);
})();
