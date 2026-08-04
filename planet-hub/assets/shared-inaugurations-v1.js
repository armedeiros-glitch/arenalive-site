(() => {
  const API_URL = '/api/hub/inauguracoes';
  const TRACKED_KEY = 'planet-hub-inaugurations-v2';
  const LEGACY_KEY = 'planet-hub-implantations-v1';
  const NAV_SCRIPT = '/planet-hub/assets/command-center-nav-fix-v1.js?v=20260804-shared1';
  const storagePrototype = Storage.prototype;
  const originalGetItem = storagePrototype.getItem;
  const originalSetItem = storagePrototype.setItem;

  let revision = null;
  let ready = false;
  let pendingSync = null;
  let suppressSync = false;
  let lastRemoteSignature = '';

  const parseArray = (value) => {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const readLocal = () => {
    const current = parseArray(originalGetItem.call(window.localStorage, TRACKED_KEY));
    if (current.length) return current;
    return parseArray(originalGetItem.call(window.localStorage, LEGACY_KEY));
  };

  const writeLocal = (items) => {
    suppressSync = true;
    originalSetItem.call(window.localStorage, TRACKED_KEY, JSON.stringify(items));
    suppressSync = false;
  };

  const signature = (items) => JSON.stringify(items || []);

  const mergeItems = (remoteItems, localItems, preferLocal = false) => {
    const merged = new Map();
    const projectIndex = new Map();

    const add = (item, source) => {
      if (!item || typeof item !== 'object') return;
      const id = String(item.id || '');
      const projectId = String(item.sourceProjectId || '');
      const existingKey = id && merged.has(id)
        ? id
        : projectId && projectIndex.has(projectId)
          ? projectIndex.get(projectId)
          : null;

      if (!existingKey) {
        const key = id || `inauguration-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        merged.set(key, { ...item, id: key });
        if (projectId) projectIndex.set(projectId, key);
        return;
      }

      const existing = merged.get(existingKey);
      const existingDate = Date.parse(existing?.updatedAt || existing?.createdAt || 0) || 0;
      const incomingDate = Date.parse(item.updatedAt || item.createdAt || 0) || 0;
      const incomingWins = preferLocal && source === 'local'
        ? true
        : incomingDate > existingDate;
      if (incomingWins) merged.set(existingKey, { ...existing, ...item, id: existingKey });
    };

    remoteItems.forEach((item) => add(item, 'remote'));
    localItems.forEach((item) => add(item, 'local'));
    return [...merged.values()];
  };

  const setStatus = (mode, note = '') => {
    const shell = document.getElementById('pmh-command-center');
    const footer = shell?.querySelector('.pmh-cc-sidebar footer');
    if (!footer) return;

    let badge = footer.querySelector('.pmh-storage-status');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'pmh-storage-status';
      badge.style.cssText = 'display:flex;align-items:center;gap:7px;margin-top:10px;font-size:11px;line-height:1.3;color:#846f65';
      footer.appendChild(badge);
    }

    const shared = mode === 'shared';
    badge.innerHTML = `<i style="width:7px;height:7px;border-radius:50%;background:${shared ? '#2f9e62' : '#d18a2f'};box-shadow:0 0 0 3px ${shared ? 'rgba(47,158,98,.12)' : 'rgba(209,138,47,.12)'}"></i><span>${shared ? 'Dados compartilhados' : 'Modo local'}${note ? ` · ${note}` : ''}</span>`;
    badge.title = shared
      ? 'As inaugurações e checklists estão sincronizados entre navegadores.'
      : 'Os dados continuam neste navegador até a base compartilhada ser vinculada.';
  };

  const request = async (options = {}) => {
    const response = await fetch(API_URL, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  const saveRemote = async (items, allowConflictRetry = true) => {
    const stampedAt = new Date().toISOString();
    const stamped = items.map((item) => ({ ...item, updatedAt: item.updatedAt || stampedAt }));
    const { response, payload } = await request({
      method: 'PUT',
      body: JSON.stringify({ data: stamped, baseRevision: revision }),
    });

    if (response.status === 409 && allowConflictRetry) {
      const merged = mergeItems(payload.data || [], stamped, true);
      revision = payload.revision || null;
      writeLocal(merged);
      return saveRemote(merged, false);
    }
    if (!response.ok) throw new Error(payload.error || 'Falha ao sincronizar inaugurações.');

    revision = payload.revision || null;
    lastRemoteSignature = signature(payload.data || stamped);
    writeLocal(payload.data || stamped);
    setStatus('shared');
    return payload.data || stamped;
  };

  const scheduleSync = (items) => {
    if (!ready || suppressSync) return;
    window.clearTimeout(pendingSync);
    pendingSync = window.setTimeout(() => {
      saveRemote(items).catch((error) => {
        console.warn('Planet Hub: sincronização compartilhada indisponível', error);
        setStatus('local', 'sincronização pendente');
      });
    }, 450);
  };

  storagePrototype.setItem = function patchedSetItem(key, value) {
    originalSetItem.call(this, key, value);
    if (this !== window.localStorage || key !== TRACKED_KEY || suppressSync) return;
    scheduleSync(parseArray(value));
  };

  const refreshFromRemote = async () => {
    if (!ready || pendingSync) return;
    try {
      const { response, payload } = await request();
      if (!response.ok || !Array.isArray(payload.data)) return;
      const remoteSignature = signature(payload.data);
      if (remoteSignature === lastRemoteSignature) return;

      revision = payload.revision || null;
      lastRemoteSignature = remoteSignature;
      writeLocal(payload.data);
      setStatus('shared');

      if (window.location.hash.includes('inauguracoes')) {
        document.querySelector('[data-pmh-open="inauguracoes"]')?.click();
      }
    } catch (_) {}
  };

  const loadNavigation = () => new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = NAV_SCRIPT;
    script.async = false;
    script.onload = resolve;
    script.onerror = () => {
      console.error('Planet Hub: não foi possível carregar o módulo de navegação.');
      resolve();
    };
    document.head.appendChild(script);
  });

  const boot = async () => {
    const localItems = readLocal();

    try {
      const { response, payload } = await request();
      if (!response.ok || !Array.isArray(payload.data)) {
        throw new Error(payload.error || 'Base compartilhada indisponível.');
      }

      revision = payload.revision || null;
      const remoteItems = payload.data;
      const merged = mergeItems(remoteItems, localItems);

      if (signature(merged) !== signature(remoteItems)) {
        await saveRemote(merged);
      } else {
        writeLocal(remoteItems);
        lastRemoteSignature = signature(remoteItems);
      }

      ready = true;
      setStatus('shared');
    } catch (error) {
      console.warn('Planet Hub: usando armazenamento local', error);
      ready = false;
      setStatus('local');
    }

    await loadNavigation();
    window.setTimeout(() => setStatus(ready ? 'shared' : 'local'), 0);

    if (ready) {
      window.setInterval(refreshFromRemote, 60_000);
      window.addEventListener('online', refreshFromRemote);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refreshFromRemote();
      });
    }
  };

  boot();
})();
