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
  const INAUGURATIONS_API = '/api/hub/inauguracoes';
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
  const itemOwnership = (item) => item?.ownership || (isAndre(item?.responsible) ? 'mine' : 'tracking');
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
    if (isDeferred(item) || itemOwnership(item) === 'info') return '';
    const due = dueMeta(item?.dueDate);
    if (['late', 'today', 'week'].includes(due.bucket)) return 'due';
    if (Number(item?.priority ?? 3) <= 1) return 'priority';
    return '';
  };

  const roleFor = (item, reason) => {
    if (reason === 'follow_up') return 'follow_up';
    return itemOwnership(item) === 'mine' ? 'mine' : 'tracking';
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

  const loadTimedInaugurations = async () => {
    if (!window.PMHInaugurationTiming?.attentionItems) return { items: [], error: 'Timing de inaugurações indisponível' };
    try {
      const response = await fetch(INAUGURATIONS_API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      return {
        items: window.PMHInaugurationTiming.attentionItems(Array.isArray(payload.data) ? payload.data : []),
        error: '',
      };
    } catch (error) {
      return { items: [], error: error instanceof Error ? error.message : String(error) };
    }
  };

  const mergeTimedInaugurations = (snapshotItems, timedItems) => {
    const items = Array.isArray(snapshotItems) ? snapshotItems : [];
    const timed = Array.isArray(timedItems) ? timedItems : [];
    if (!timed.length) return items;

    const contextById = new Map(items
      .filter((item) => String(item?.id || '').startsWith('inauguration-'))
      .map((item) => [String(item.id), item]));
    const nonInaugurations = items.filter((item) => !String(item?.id || '').startsWith('inauguration-'));
    const enriched = timed.map((item) => {
      const previous = contextById.get(String(item.id)) || {};
      return {
        ...item,
        operationalState: previous.operationalState || 'actionable',
        blockerReason: previous.blockerReason || '',
        dependsOn: previous.dependsOn || '',
        followUpDate: previous.followUpDate || '',
        contextUpdatedAt: previous.contextUpdatedAt || '',
        contextSuggestion: previous.contextSuggestion || null,
        nextAction: previous.nextAction || item.nextAction || '',
      };
    });
    return [...nonInaugurations, ...enriched];
  };

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

    pending = Promise.all([
      window.PMHRadarData.collect({ force, maxAgeMs: 15_000 }),
      loadTimedInaugurations(),
    ])
      .then(async ([snapshot, inaugurationTiming]) => {
        const operationalItems = mergeTimedInaugurations(snapshot?.items, inaugurationTiming.items);
        const attention = deriveAttention(operationalItems);
        const sourceErrors = Array.isArray(snapshot?.errors) ? [...snapshot.errors] : [];
        if (inaugurationTiming.error) sourceErrors.push('Timing de inaugurações');

        current = Object.freeze({
          items: attention.slice(0, MAX_VISIBLE),
          total: attention.length,
          loadedAt: snapshot?.loadedAt || new Date().toISOString(),
          sourceErrors,
          unavailable: false,
        });
        publish(current);
        await postReconciliation({ ...snapshot, items: operationalItems }).catch(() => null);
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
    mergeTimedInaugurations,
  });
})();
