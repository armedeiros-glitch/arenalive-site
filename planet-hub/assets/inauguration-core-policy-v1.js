(() => {
  'use strict';

  const VERSION = '20260828-1';
  const TRACKED_KEY = 'planet-hub-inaugurations-v2';
  const INAUGURATIONS_PATH = '/api/hub/inauguracoes';
  const PROJECTS_PATH = '/api/sults/implantacoes';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const ownerFor = (action, fallback = '') => {
    const key = normalize(action);
    if (key === 'criacao/ajuste do instagram') return 'Franqueadora';
    if (key === 'criacao/ajuste do facebook') return 'Franqueadora';
    if (key === 'google meu negocio') return 'Franqueadora';
    if (key === 'video de inauguracao') return 'Franqueado';
    if (key === 'contratar influenciadores') return 'Franqueadora';
    if (key === 'contratar social media para inauguracao') return 'Franqueadora';
    if (key === 'contratar ornamentacao / arco de bolas') return 'Franqueadora';
    if (key === 'enviar @ dos influenciadores') return 'Franqueado';
    if (key === 'enviar nomes/@ e contatos dos influenciadores locais') return 'Franqueado';
    if (key === 'enviar contato/indicacao de social media local') return 'Franqueado';
    if (key === 'enviar contato/empresa de ornamentacao / arco de bolas') return 'Franqueado';
    return String(fallback || '').trim();
  };

  const canonicalAction = (action) => {
    const key = normalize(action);
    if (key === 'enviar @ dos influenciadores') return 'Enviar nomes/@ e contatos dos influenciadores locais';
    return String(action || '').trim();
  };

  const insertBefore = (checklist, targetAction, step) => {
    const exists = checklist.some((item) => normalize(item?.action) === normalize(step.action));
    if (exists) return checklist;
    const targetIndex = checklist.findIndex((item) => normalize(item?.action) === normalize(targetAction));
    if (targetIndex < 0) return [...checklist, step];
    return [...checklist.slice(0, targetIndex), step, ...checklist.slice(targetIndex)];
  };

  const normalizeChecklist = (checklist) => {
    let next = (Array.isArray(checklist) ? checklist : []).map((step) => {
      const action = canonicalAction(step?.action);
      return {
        ...step,
        action,
        owner: ownerFor(action, step?.owner),
      };
    });

    next = insertBefore(next, 'Contratar influenciadores', {
      action: 'Enviar nomes/@ e contatos dos influenciadores locais',
      owner: 'Franqueado',
      daysBefore: 20,
      done: false,
    });
    next = insertBefore(next, 'Contratar Social Media para inauguração', {
      action: 'Enviar contato/indicação de Social Media local',
      owner: 'Franqueado',
      daysBefore: 20,
      done: false,
    });
    next = insertBefore(next, 'Contratar ornamentação / arco de bolas', {
      action: 'Enviar contato/empresa de ornamentação / arco de bolas',
      owner: 'Franqueado',
      daysBefore: 20,
      done: false,
    });

    return next;
  };

  const normalizeInauguration = (item) => {
    if (!item || typeof item !== 'object') return item;
    return {
      ...item,
      checklist: Array.isArray(item.checklist) ? normalizeChecklist(item.checklist) : item.checklist,
    };
  };

  const normalizeInaugurationPayload = (payload) => {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) return payload;
    return { ...payload, data: payload.data.map(normalizeInauguration) };
  };

  const adaptOperationalProjects = (payload) => {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.data)) return payload;
    return {
      ...payload,
      data: payload.data.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const sourceActive = Boolean(item.active);
        const operationalActive = !item.completed && (sourceActive || Boolean(item.paused));
        return {
          ...item,
          sourceActive,
          operationalActive,
          active: operationalActive,
        };
      }),
    };
  };

  const normalizeLocalStore = () => {
    try {
      const current = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      if (!Array.isArray(current)) return false;
      const next = current.map(normalizeInauguration);
      const before = JSON.stringify(current);
      const after = JSON.stringify(next);
      if (before === after) return false;
      window.localStorage.setItem(TRACKED_KEY, after);
      return true;
    } catch (_) {
      return false;
    }
  };

  const parseUrl = (input) => {
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      return new URL(raw, window.location.origin);
    } catch (_) {
      return null;
    }
  };

  const jsonResponse = (response, payload) => {
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify(payload), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = parseUrl(input);
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    let nextInput = input;
    let nextInit = init;

    if (url?.pathname === INAUGURATIONS_PATH && ['PUT', 'POST', 'PATCH'].includes(method)) {
      let rawBody = init?.body;
      if (rawBody == null && input instanceof Request) {
        try { rawBody = await input.clone().text(); } catch (_) { rawBody = null; }
      }
      if (typeof rawBody === 'string' && rawBody) {
        try {
          const body = JSON.parse(rawBody);
          const normalized = normalizeInaugurationPayload(body);
          const serialized = JSON.stringify(normalized);
          if (typeof input === 'string') nextInit = { ...init, body: serialized };
          else nextInput = new Request(input, { ...init, body: serialized });
        } catch (_) {}
      }
    }

    const response = await nativeFetch(nextInput, nextInit);
    if (!url) return response;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response;

    let payload;
    try { payload = await response.clone().json(); } catch (_) { return response; }

    if (url.pathname === INAUGURATIONS_PATH) {
      return jsonResponse(response, normalizeInaugurationPayload(payload));
    }

    if (url.pathname === PROJECTS_PATH && url.searchParams.get('scope') !== 'all') {
      return jsonResponse(response, adaptOperationalProjects(payload));
    }

    return response;
  };

  const applyCopyFixes = (root = document) => {
    const replacements = new Map([
      ['Checklist de 15 etapas e seis ações inaugurais com controle financeiro.', 'Checklist de 17 etapas e seis ações inaugurais com controle financeiro.'],
      ['Implantações ativas', 'Implantações operacionais'],
      ['Projetos ativos', 'Ativos ou pausados'],
    ]);
    root.querySelectorAll?.('small, span, h3, p').forEach((node) => {
      const next = replacements.get(String(node.textContent || '').trim());
      if (next) node.textContent = next;
    });
  };

  normalizeLocalStore();
  document.addEventListener('DOMContentLoaded', () => applyCopyFixes(), { once: true });
  window.addEventListener('pmh:view-rendered', (event) => applyCopyFixes(event.detail?.content || document));
  window.addEventListener('storage', (event) => { if (event.key === TRACKED_KEY) normalizeLocalStore(); });

  window.PlanetInaugurationCorePolicy = Object.freeze({
    VERSION,
    ownerFor,
    normalizeChecklist,
    normalizeInauguration,
    normalizeInaugurationPayload,
    adaptOperationalProjects,
    normalizeLocalStore,
  });
})();
