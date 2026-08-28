(() => {
  'use strict';

  const SOURCE_PREFIX = Object.freeze({
    tickets: 'ticket-',
    inaugurations: 'inauguration-',
    demands: 'demand-',
    contents: 'content-',
    campaigns: 'campaign-',
  });
  const CONTEXT_API = '/api/hub/radar-contextos';
  const MAX_VISIBLE = 5;

  let current = Object.freeze({
    items: [],
    total: 0,
    loadedAt: '',
    sourceErrors: [],
    unavailable: false,
  });
  let pending = null;

  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
    ? String(value).slice(0, 10)
    : '';

  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const isAndre = (value) => /\bandre\b/.test(normalizeText(value));
  const isDeferred = (item) => item?.operationalState && item.operationalState !== 'actionable';
  const followUpDue = (item) => {
    const followUp = cleanDate(item?.followUpDate);
    return Boolean(isDeferred(item) && followUp && followUp <= todayIso());
  };

  const dueMeta = (value) => window.PMHRadarData?.dueMeta?.(value) || {
    bucket: cleanDate(value) && cleanDate(value) <= todayIso() ? 'today' : 'later',
    weight: 99999,
    label: cleanDate(value) || 'Sem prazo',
  };

  const attentionReason = (item) => {
    if (followUpDue(item)) return 'follow_up';
    if (!isAndre(item?.responsible) || isDeferred(item)) return '';
    const due = dueMeta(item?.dueDate);
    if (['late', 'today', 'week'].includes(due.bucket)) return 'due';
    if (Number(item?.priority ?? 3) <= 1) return 'priority';
    return '';
  };

  const roleFor = (item, reason) => {
    if (isAndre(item?.responsible)) return 'mine';
    if (reason === 'follow_up') return 'follow_up';
    return 'tracking';
  };

  const attentionDate = (item, reason) => reason === 'follow_up'
    ? cleanDate(item?.followUpDate)
    : cleanDate(item?.dueDate);

  const rank = (item) => {
    const meta = dueMeta(item.attentionDate);
    const roleWeight = item.role === 'follow_up' ? -1000 : item.role === 'mine' ? 0 : 1000;
    return roleWeight + Number(meta.weight ?? 99999) * 10 + Number(item.priority ?? 3);
  };

  const deriveAttention = (items) => (Array.isArray(items) ? items : [])
    .map((item) => {
      const reason = attentionReason(item);
      if (!reason) return null;
      return {
        ...item,
        attentionReason: reason,
        attentionDate: attentionDate(item, reason),
        role: roleFor(item, reason),
      };
    })
    .filter(Boolean)
    .sort((a, b) => rank(a) - rank(b));

  const postReconciliation = async (snapshot) => {
    const sources = snapshot?.sources || {};
    if (sources.contexts?.reliability !== 'fresh') return null;

    const authoritativeSources = Object.keys(SOURCE_PREFIX)
      .filter((key) => sources[key]?.reliability === 'fresh');
    if (!authoritativeSources.length) return null;

    const prefixes = authoritativeSources.map((key) => SOURCE_PREFIX[key]);
    const activeItemIds = (Array.isArray(snapshot?.items) ? snapshot.items : [])
      .map((item) => String(item?.id || ''))
      .filter((id) => prefixes.some((prefix) => id.startsWith(prefix)));

    const response = await fetch(CONTEXT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ prefixes, activeItemIds }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);

    if (Array.isArray(payload.removed) && payload.removed.length) {
      window.PMHRadarData?.invalidate?.(['contexts']);
      window.dispatchEvent(new CustomEvent('andre-os:operational-contexts-pruned', {
        detail: { removed: payload.removed },
      }));
    }
    return payload;
  };

  const publish = (snapshot) => {
    window.dispatchEvent(new CustomEvent('andre-os:operational-attention', { detail: snapshot }));
    return snapshot;
  };

  const refresh = async ({ force = false } = {}) => {
    if (pending) return pending;
    if (!window.PMHRadarData?.collect) {
      current = Object.freeze({
        items: [], total: 0, loadedAt: new Date().toISOString(), sourceErrors: ['Radar operacional'], unavailable: true,
      });
      return publish(current);
    }

    pending = window.PMHRadarData.collect({ force, maxAgeMs: 15_000 })
      .then(async (snapshot) => {
        const attention = deriveAttention(snapshot?.items);
        current = Object.freeze({
          items: attention.slice(0, MAX_VISIBLE),
          total: attention.length,
          loadedAt: snapshot?.loadedAt || new Date().toISOString(),
          sourceErrors: Array.isArray(snapshot?.errors) ? snapshot.errors : [],
          unavailable: false,
        });
        publish(current);
        await postReconciliation(snapshot).catch(() => null);
        return current;
      })
      .catch((error) => {
        current = Object.freeze({
          items: [],
          total: 0,
          loadedAt: new Date().toISOString(),
          sourceErrors: [String(error instanceof Error ? error.message : error)],
          unavailable: true,
        });
        return publish(current);
      })
      .finally(() => { pending = null; });

    return pending;
  };

  const getSnapshot = () => current;

  window.AndreOSOperationalAttention = Object.freeze({
    refresh,
    getSnapshot,
    deriveAttention,
  });
})();
