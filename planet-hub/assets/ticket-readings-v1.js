(() => {
  'use strict';

  const CACHE_PREFIX = 'pmh:ticket-reading:v1:';
  const CACHE_TTL_MS = 15 * 60 * 1000;
  const MAX_TICKETS = 5;
  const START_DELAY_MS = 500;

  let baseRadar = null;
  let enrichedSnapshot = null;
  let processing = false;
  let queuedSnapshot = null;
  let lastSignature = '';
  let decorateTimer = 0;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const textFromHtml = (html) => {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return parsed.body.textContent?.replace(/\s+/g, ' ').trim() || '';
  };

  const cleanExcerpt = (value, max = 260) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
  };

  const ageLabel = (value) => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return 'data não informada';
    const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (minutes < 2) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.round(hours / 24);
    return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  };

  const isVisible = () => document.visibilityState === 'visible' && navigator.onLine !== false;
  const isAndre = (value) => /\bandre\b/.test(normalize(value));
  const samePerson = (left, right) => Boolean(left && right && normalize(left) === normalize(right));

  const usefulInteraction = (entry) => {
    if (!entry?.interaction?.messageHtml) return false;
    const text = textFromHtml(entry.interaction.messageHtml);
    if (text.length < 8) return false;
    return !/^(ok|certo|obrigad[oa]|bom dia|boa tarde|boa noite|valeu|perfeito)[.! ]*$/i.test(text);
  };

  const latestUsefulInteraction = (timeline) => [...(Array.isArray(timeline) ? timeline : [])]
    .filter(usefulInteraction)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))[0] || null;

  const namedDependency = (message) => {
    if (/franquead/i.test(message)) return 'Franqueado';
    if (/fornecedor/i.test(message)) return 'Fornecedor';
    if (/shopping/i.test(message)) return 'Shopping';
    if (/financeir/i.test(message)) return 'Financeiro';
    if (/ag[eê]ncia/i.test(message)) return 'Agência';
    if (/gr[aá]fica/i.test(message)) return 'Gráfica';
    return '';
  };

  const inferReading = (payload, item) => {
    const ticket = payload?.ticket || {};
    const interaction = latestUsefulInteraction(payload?.timeline);
    if (!interaction) return null;

    const text = textFromHtml(interaction.interaction.messageHtml);
    const normalized = normalize(text);
    const author = interaction.person?.name || 'Pessoa não identificada';
    const requester = ticket.requester?.name || item.requester || '';
    const responsible = ticket.responsible?.name || item.responsible || '';
    const explicitDependency = namedDependency(text);

    const approval = /aguardando aprova|aguardo aprova|aprova[cç][aã]o|precisa aprovar|para aprova[cç][aã]o|validar antes|autoriza[cç][aã]o/i.test(normalized);
    const released = /pode seguir|podem seguir|aprovad[oa]|liberad[oa]|ok para seguir|est[aá] aprovado/i.test(normalized);
    const promise = /vou enviar|irei enviar|vou mandar|encaminho|envio ainda|retorno com|vou verificar|estou verificando/i.test(normalized);
    const missing = /preciso|falta|faltam|aguardando|enviar|mandar|encaminhar|pesquis|pre[cç]o|or[cç]amento|arquivo|foto|documento|material|informa[cç][aã]o/i.test(normalized);
    const question = /consegue|poderia|pode me|favor|por gentileza|precisamos que/i.test(normalized);

    let state = '';
    let dependsOn = explicitDependency;
    let nextAction = 'Revisar a última interação e registrar o próximo movimento concreto.';
    let confidence = 'medium';

    if (released) {
      state = 'actionable';
      nextAction = 'Executar o próximo passo liberado e atualizar o andamento do chamado.';
      confidence = 'high';
    } else if (approval) {
      state = 'waiting_approval';
      dependsOn ||= samePerson(author, responsible) && !isAndre(author) ? author : responsible;
      nextAction = `Acompanhar a aprovação${dependsOn ? ` com ${dependsOn}` : ''} e avançar assim que houver retorno.`;
      confidence = 'high';
    } else if (promise || missing || question) {
      state = 'waiting_info';
      if (!dependsOn) {
        if (samePerson(author, requester) && promise) dependsOn = author;
        else if (samePerson(author, responsible) && question) dependsOn = requester;
        else if (!isAndre(author) && promise) dependsOn = author;
        else dependsOn = requester || responsible;
      }
      nextAction = `Cobrar ou receber o retorno${dependsOn ? ` de ${dependsOn}` : ''}, revisar o conteúdo e atualizar a previsão.`;
      confidence = promise || explicitDependency ? 'high' : 'medium';
    }

    const reason = `Na última interação, ${author} informou: “${cleanExcerpt(text, 220)}”`;
    const suggestion = state ? {
      state,
      reason,
      dependsOn: dependsOn || '',
      nextAction,
      source: 'Última interação do SULTS',
      confidence,
    } : null;

    return {
      text: cleanExcerpt(text),
      author,
      createdAt: interaction.createdAt || '',
      age: ageLabel(interaction.createdAt),
      internal: Boolean(interaction.interaction.internal),
      reason,
      suggestion,
      loadedAt: new Date().toISOString(),
    };
  };

  const cacheKey = (item) => `${CACHE_PREFIX}${item.sourceId}:${item.updatedAt || 'unknown'}`;

  const readCache = (item) => {
    try {
      const value = JSON.parse(sessionStorage.getItem(cacheKey(item)) || 'null');
      if (!value || Date.now() - Number(value.cachedAt || 0) > CACHE_TTL_MS) return null;
      return value.reading || null;
    } catch {
      return null;
    }
  };

  const writeCache = (item, reading) => {
    try {
      sessionStorage.setItem(cacheKey(item), JSON.stringify({ cachedAt: Date.now(), reading }));
    } catch {
      // Cache é apenas uma otimização. A leitura continua funcionando sem ele.
    }
  };

  const fetchReading = async (item) => {
    const cached = readCache(item);
    if (cached) return cached;

    const response = await fetch(`/api/sults/chamados/${encodeURIComponent(item.sourceId)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    const reading = inferReading(payload, item);
    if (reading) writeCache(item, reading);
    return reading;
  };

  const candidateScore = (item) => {
    const due = baseRadar.dueMeta(item.dueDate);
    let score = Number(item.priority || 2) * 30;
    if (due.bucket === 'late') score -= 10000;
    else if (due.bucket === 'today') score -= 8000;
    else if (due.bucket === 'week') score -= 5000;
    if (/aguardando/i.test(item.status)) score -= 2500;
    if (/aprova/i.test(item.status)) score -= 1800;
    if (item.contextSuggestion) score -= 600;
    if ((item.operationalState || 'actionable') !== 'actionable') score += 300;
    return score;
  };

  const candidatesFrom = (snapshot) => [...(snapshot?.items || [])]
    .filter((item) => item.action === 'chamados' && item.sourceId)
    .sort((a, b) => candidateScore(a) - candidateScore(b))
    .slice(0, MAX_TICKETS);

  const signatureFor = (items) => items.map((item) => `${item.id}:${item.updatedAt || ''}`).join('|');

  const mergeReadings = (snapshot, readings) => {
    const byId = new Map(readings.filter((entry) => entry.reading).map((entry) => [entry.item.id, entry.reading]));
    const items = (snapshot.items || []).map((item) => {
      const ticketReading = byId.get(item.id) || item.ticketReading || null;
      if (!ticketReading) return item;
      const hasSavedContext = (item.operationalState || 'actionable') !== 'actionable'
        || item.blockerReason || item.dependsOn || item.nextAction || item.followUpDate;
      return {
        ...item,
        ticketReading,
        contextSuggestion: hasSavedContext
          ? item.contextSuggestion
          : ticketReading.suggestion || item.contextSuggestion,
      };
    });

    return {
      ...snapshot,
      items,
      ticketReadings: true,
      ticketReadingsLoadedAt: new Date().toISOString(),
    };
  };

  const dispatchEnriched = (snapshot) => {
    enrichedSnapshot = snapshot;
    window.dispatchEvent(new CustomEvent('pmh:radar-data', { detail: snapshot }));
    scheduleDecorate();
  };

  const enhance = async (snapshot) => {
    if (!snapshot || snapshot.ticketReadings || !isVisible()) return;
    if (processing) {
      queuedSnapshot = snapshot;
      return;
    }

    const candidates = candidatesFrom(snapshot);
    if (!candidates.length) return;
    const signature = signatureFor(candidates);
    if (signature === lastSignature && enrichedSnapshot) {
      dispatchEnriched({ ...snapshot, items: enrichedSnapshot.items, ticketReadings: true });
      return;
    }

    processing = true;
    lastSignature = signature;
    try {
      const results = await Promise.all(candidates.map(async (item) => {
        try {
          return { item, reading: await fetchReading(item) };
        } catch {
          return { item, reading: null };
        }
      }));
      dispatchEnriched(mergeReadings(snapshot, results));
    } finally {
      processing = false;
      if (queuedSnapshot) {
        const queued = queuedSnapshot;
        queuedSnapshot = null;
        enhance(queued);
      }
    }
  };

  const readingMarkup = (item) => {
    const reading = item?.ticketReading;
    if (!reading) return '';
    return `<section class="pmh-ticket-reading-card" data-ticket-reading-card="${esc(item.id)}">
      <header><small>🔎 LEITURA DO ÚLTIMO RETORNO</small><span>${esc(reading.author)} · ${esc(reading.age)}</span></header>
      <p>${esc(reading.text)}</p>
      ${reading.suggestion ? `<footer><strong>${esc(reading.suggestion.dependsOn ? `A bola parece estar com ${reading.suggestion.dependsOn}` : 'Há um próximo movimento sugerido')}</strong><span>${esc(reading.suggestion.nextAction)}</span></footer>` : ''}
    </section>`;
  };

  const decorateCockpit = (snapshot) => {
    const button = document.querySelector('[data-decision-cockpit] [data-attention-open]');
    const item = snapshot?.items?.find((candidate) => candidate.id === button?.dataset.attentionOpen);
    const main = document.querySelector('[data-decision-cockpit] .pmh-decision-main');
    if (!main) return;
    main.querySelector('[data-ticket-reading-card]')?.remove();
    if (!item?.ticketReading) return;
    const next = main.querySelector('.pmh-decision-next');
    if (next) next.insertAdjacentHTML('beforebegin', readingMarkup(item));
    else main.insertAdjacentHTML('beforeend', readingMarkup(item));
  };

  const decorateRows = (snapshot) => {
    document.querySelectorAll('[data-radar-context]').forEach((button) => {
      const item = snapshot?.items?.find((candidate) => candidate.id === button.dataset.radarContext);
      button.classList.toggle('has-ticket-reading', Boolean(item?.ticketReading));
      if (item?.ticketReading && !button.querySelector('.pmh-reading-dot')) {
        button.insertAdjacentHTML('afterbegin', '<i class="pmh-reading-dot" aria-hidden="true"></i>');
      }
      if (!item?.ticketReading) button.querySelector('.pmh-reading-dot')?.remove();
    });
  };

  const decorateDrawer = (snapshot) => {
    const panel = document.querySelector('.pmh-ticket-drawer-panel:not(.loading)');
    if (!panel || panel.querySelector('[data-drawer-ticket-reading]')) return;
    const id = panel.querySelector('.pmh-ticket-drawer-header small')?.textContent?.replace(/\D/g, '');
    const item = snapshot?.items?.find((candidate) => candidate.id === `ticket-${id}`);
    if (!item?.ticketReading) return;
    const actions = panel.querySelector('.pmh-ticket-drawer-actions');
    const wrapper = document.createElement('div');
    wrapper.dataset.drawerTicketReading = '1';
    wrapper.innerHTML = readingMarkup(item);
    actions?.insertAdjacentElement('afterend', wrapper);
  };

  const decorate = () => {
    const snapshot = enrichedSnapshot || baseRadar?.getSnapshot?.();
    if (!snapshot) return;
    decorateCockpit(snapshot);
    decorateRows(snapshot);
    decorateDrawer(snapshot);
  };

  const scheduleDecorate = () => {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorate, 50);
  };

  const wrapRadar = () => {
    if (baseRadar || !window.PMHRadarData) return Boolean(baseRadar);
    baseRadar = window.PMHRadarData;
    const wrapped = {
      ...baseRadar,
      getSnapshot: () => enrichedSnapshot || baseRadar.getSnapshot(),
      collect: async (options) => {
        const snapshot = await baseRadar.collect(options);
        enhance(snapshot);
        return enrichedSnapshot || snapshot;
      },
      invalidate: () => {
        enrichedSnapshot = null;
        lastSignature = '';
        baseRadar.invalidate();
      },
    };
    window.PMHRadarData = Object.freeze(wrapped);
    return true;
  };

  window.addEventListener('pmh:radar-data', (event) => {
    if (event.detail?.ticketReadings) {
      enrichedSnapshot = event.detail;
      scheduleDecorate();
      return;
    }
    enhance(event.detail);
  });

  document.addEventListener('visibilitychange', () => {
    if (isVisible()) enhance(baseRadar?.getSnapshot?.());
  });

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const bootstrap = () => {
    if (!wrapRadar()) return setTimeout(bootstrap, START_DELAY_MS);
    enhance(baseRadar.getSnapshot());
    scheduleDecorate();
  };

  setTimeout(bootstrap, START_DELAY_MS);
})();
