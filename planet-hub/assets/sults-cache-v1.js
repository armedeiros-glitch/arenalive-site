(() => {
  const CACHE_PREFIX = 'planet-hub-sults-cache-v1:';
  const nativeFetch = window.fetch.bind(window);
  const state = new Map();

  const isSultsRoute = (url) =>
    url.includes('/api/sults/chamados') || url.includes('/api/sults/implantacoes');

  const cacheKey = (url) => {
    try {
      const parsed = new URL(url, window.location.origin);
      const scope = parsed.searchParams.get('scope') || '';
      const personId = parsed.searchParams.get('personId') || '';
      const personName = parsed.searchParams.get('personName') || '';
      return `${CACHE_PREFIX}${parsed.pathname}?scope=${scope}&personId=${personId}&personName=${personName}`;
    } catch (_) {
      return `${CACHE_PREFIX}${url}`;
    }
  };

  const readCache = (key) => {
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || 'null');
      if (!value || typeof value !== 'object' || !value.payload) return null;
      return value;
    } catch (_) {
      return null;
    }
  };

  const writeCache = (key, payload) => {
    try {
      window.localStorage.setItem(key, JSON.stringify({
        savedAt: new Date().toISOString(),
        payload,
      }));
    } catch (_) {}
  };

  const cachedResponse = (cached, originalStatus = 503) => {
    const payload = {
      ...cached.payload,
      cache: {
        stale: true,
        savedAt: cached.savedAt,
        originalStatus,
      },
      warning: 'O SULTS está indisponível. Exibindo a última sincronização salva.',
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Cache-Control': 'no-store',
        'X-Planet-Cache': 'stale',
      },
    });
  };

  const markFresh = (url) => {
    state.delete(url);
    window.dispatchEvent(new CustomEvent('pmh-sults-cache-change', {
      detail: { url, stale: false },
    }));
  };

  const markStale = (url, savedAt) => {
    state.set(url, savedAt);
    window.dispatchEvent(new CustomEvent('pmh-sults-cache-change', {
      detail: { url, stale: true, savedAt },
    }));
  };

  window.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!isSultsRoute(url)) return nativeFetch(...args);

    const key = cacheKey(url);

    try {
      const response = await nativeFetch(...args);
      if (response.ok) {
        try {
          const payload = await response.clone().json();
          if (Array.isArray(payload?.data)) writeCache(key, payload);
        } catch (_) {}
        markFresh(url);
        return response;
      }

      const cached = readCache(key);
      if (cached) {
        markStale(url, cached.savedAt);
        return cachedResponse(cached, response.status);
      }

      return response;
    } catch (error) {
      const cached = readCache(key);
      if (cached) {
        markStale(url, cached.savedAt);
        return cachedResponse(cached, 0);
      }
      throw error;
    }
  };

  const formatSavedAt = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'horário não informado';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  };

  const renderBanner = () => {
    const content = document.querySelector('#pmh-command-center [data-pmh-content]');
    if (!content) return;

    let banner = content.querySelector('.pmh-sults-cache-banner');
    const stale = [...state.values()].filter(Boolean);

    if (!stale.length) {
      banner?.remove();
      return;
    }

    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'pmh-sults-cache-banner';
      content.prepend(banner);
    }

    const latest = stale.sort().at(-1);
    banner.innerHTML = `<strong>Modo seguro ativado</strong><span>O SULTS não respondeu. Mantivemos os dados salvos em ${formatSavedAt(latest)}.</span>`;
  };

  window.addEventListener('pmh-sults-cache-change', () => window.setTimeout(renderBanner, 0));
  new MutationObserver(renderBanner).observe(document.body, { childList: true, subtree: true });
})();
