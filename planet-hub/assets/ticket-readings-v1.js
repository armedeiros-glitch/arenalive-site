(() => {
  'use strict';

  const CACHE_PREFIX = 'pmh:ticket-reading:v1:';
  const CACHE_TTL_MS = 15 * 60 * 1000;
  const MAX_TICKETS = 5;

  let enrichedSnapshot = null;
  let processing = false;
  let queuedSnapshot = null;
  let lastSignature = '';
  let decorateTimer = 0;
  const memoryReadings = new Map();

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
  const hasTicketSource = (snapshot) => Boolean(snapshot?.sources && Object.prototype.hasOwnProperty.call(snapshot.sources, 'tickets'));

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

  const rememberReading = (item, reading) => {
    if (!item?.id || !reading) return;
    memoryReadings.set(item.id, { version: item.updatedAt || '', reading });
  };

  const recalledReading = (item) => {
    const remembered = memoryReadings.get(item?.id);
    return remembered && remembered.version === (item.updatedAt || '') ? remembered.reading : null;
  };

  const fetchReading = async (item) => {
    const remembered = recalledReading(item);
    if (remembered) return remembered;
    const cached = readCache(item);
    if (cached) {
      rememberReading(item, cached);
      return cached;
    }

    const response = await fetch(`/api/sults/chamados/${encodeURIComponent(item.sourceId)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    const reading = inferReading(payload, item);
    if (reading) {
      writeCache(item, reading);
      rememberReading(item, reading);
    }
    return reading;
  };

  const candidateScore = (item) => {
    const radar = window.PMHRadarData;
    if (!radar?.dueMeta) return 0;
    const due = radar.dueMeta(item.dueDate);
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

  const mergeReadings = (snapshot, readings = []) => {
    readings.forEach((entry) => rememberReading(entry.item, entry.reading));
    const incoming = new Map(readings.filter((entry) => entry.reading).map((entry) => [entry.item.id, entry.reading]));
    const items = (snapshot.items || []).map((item) => {
      const ticketReading = incoming.get(item.id) || recalledReading(item) || item.ticketReading || null;
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

  const dispatchReadings = (snapshot) => {
    enrichedSnapshot = snapshot;
    const readings = (snapshot?.items || [])
      .filter((item) => item.ticketReading)
      .map((item) => ({ ticketId: item.id, reading: item.ticketReading }));
    window.dispatchEvent(new CustomEvent('pmh:ticket-readings', {
      detail: {
        snapshot,
        readings,
        loadedAt: snapshot.ticketReadingsLoadedAt || new Date().toISOString(),
      },
    }));
  };

  const enhance = async (snapshot) => {
    if (!snapshot || !hasTicketSource(snapshot) || snapshot.ticketReadings || !isVisible()) return;
    if (processing) {
      queuedSnapshot = snapshot;
      return;
    }

    const candidates = candidatesFrom(snapshot);
    if (!candidates.length) return;
    const signature = signatureFor(candidates);
    if (signature === lastSignature && enrichedSnapshot) {
      dispatchReadings(mergeReadings(snapshot));
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
      dispatchReadings(mergeReadings(snapshot, results));
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

  const usefulListSuggestion = (item) => {
    const suggestion = item?.ticketReading?.suggestion;
    if (!suggestion || !['high', 'medium'].includes(suggestion.confidence)) return null;
    const dependsOn = cleanExcerpt(suggestion.dependsOn, 48);
    const nextAction = cleanExcerpt(suggestion.nextAction, 110);
    if (!dependsOn && !nextAction) return null;
    return { dependsOn, nextAction, confidence: suggestion.confidence };
  };

  const listReadingMarkup = (item) => {
    const suggestion = usefulListSuggestion(item);
    if (!suggestion) return '';
    const signature = `${suggestion.dependsOn}|${suggestion.nextAction}|${suggestion.confidence}`;
    return `<div class="pmh-ticket-list-reading" data-ticket-list-reading data-reading-signature="${esc(signature)}">
      ${suggestion.dependsOn ? `<span><small>Bola com</small><strong>${esc(suggestion.dependsOn)}</strong></span>` : ''}
      ${suggestion.nextAction ? `<span class="next"><small>Próximo</small><strong>${esc(suggestion.nextAction)}</strong></span>` : ''}
    </div>`;
  };

  const ensureListStyles = () => {
    if (document.querySelector('style[data-ticket-list-reading-style]')) return;
    const style = document.createElement('style');
    style.dataset.ticketListReadingStyle = '1';
    style.textContent = `
      .pmh-command-ticket .pmh-ticket-list-reading{display:flex;gap:8px 18px;align-items:flex-start;flex-wrap:wrap;margin:8px 0 2px;padding:8px 10px;border:1px solid var(--aos-border-subtle,rgba(127,127,127,.18));border-radius:10px;background:rgba(127,127,127,.045);font-size:12px;line-height:1.35}
      .pmh-command-ticket .pmh-ticket-list-reading>span{display:flex;gap:5px;align-items:baseline;min-width:0}
      .pmh-command-ticket .pmh-ticket-list-reading>span.next{flex:1 1 320px}
      .pmh-command-ticket .pmh-ticket-list-reading small{font-size:10px;letter-spacing:.04em;text-transform:uppercase;opacity:.58;white-space:nowrap}
      .pmh-command-ticket .pmh-ticket-list-reading strong{font-size:12px;font-weight:600;opacity:.82;min-width:0}
    `;
    document.head.appendChild(style);
  };

  const decorateTicketList = (snapshot) => {
    ensureListStyles();
    document.querySelectorAll('.pmh-command-ticket[data-ticket-id]').forEach((card) => {
      const item = snapshot?.items?.find((candidate) => candidate.id === `ticket-${card.dataset.ticketId}`);
      const suggestion = usefulListSuggestion(item);
      const existing = card.querySelector('[data-ticket-list-reading]');
      if (!suggestion) {
        existing?.remove();
        return;
      }
      const signature = `${suggestion.dependsOn}|${suggestion.nextAction}|${suggestion.confidence}`;
      if (existing?.dataset.readingSignature === signature) return;
      existing?.remove();
      const facts = card.querySelector('.pmh-command-ticket-facts');
      if (facts) facts.insertAdjacentHTML('beforebegin', listReadingMarkup(item));
    });
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

  const requestDrawerReading = (panel, snapshot, item) => {
    if (!item || panel.dataset.readingRequested === '1') return;
    panel.dataset.readingRequested = '1';
    fetchReading(item).then((reading) => {
      if (!reading) return;
      const current = enrichedSnapshot || snapshot;
      dispatchReadings(mergeReadings(current, [{ item, reading }]));
    }).catch(() => {
      panel.dataset.readingRequested = '0';
    });
  };

  const decorateDrawer = (snapshot) => {
    const panel = document.querySelector('.pmh-ticket-drawer-panel:not(.loading)');
    if (!panel || panel.querySelector('[data-drawer-ticket-reading]')) return;
    const id = panel.querySelector('.pmh-ticket-drawer-header small')?.textContent?.replace(/\D/g, '');
    const item = snapshot?.items?.find((candidate) => candidate.id === `ticket-${id}`);
    if (!item) return;
    if (!item.ticketReading) {
      requestDrawerReading(panel, snapshot, item);
      return;
    }
    const actions = panel.querySelector('.pmh-ticket-drawer-actions');
    const wrapper = document.createElement('div');
    wrapper.dataset.drawerTicketReading = '1';
    wrapper.innerHTML = readingMarkup(item);
    actions?.insertAdjacentElement('afterend', wrapper);
  };

  const decorate = () => {
    const snapshot = enrichedSnapshot || window.PMHRadarData?.getSnapshot?.();
    if (!snapshot) return;
    decorateTicketList(snapshot);
    decorateCockpit(snapshot);
    decorateRows(snapshot);
    decorateDrawer(snapshot);
  };

  const scheduleDecorate = () => {
    clearTimeout(decorateTimer);
    decorateTimer = setTimeout(decorate, 50);
  };

  window.addEventListener('pmh:radar-data', (event) => {
    enhance(event.detail);
  });

  window.addEventListener('pmh:radar-data-partial', (event) => {
    enhance(event.detail);
  });

  window.addEventListener('pmh:ticket-readings', (event) => {
    if (event.detail?.snapshot) enrichedSnapshot = event.detail.snapshot;
    scheduleDecorate();
  });

  document.addEventListener('visibilitychange', () => {
    if (!isVisible()) return;
    const snapshot = window.PMHRadarData?.getSnapshot?.();
    if (snapshot) enhance(snapshot);
  });

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const initialSnapshot = window.PMHRadarData?.getSnapshot?.();
  if (initialSnapshot) enhance(initialSnapshot);
  scheduleDecorate();
})();
