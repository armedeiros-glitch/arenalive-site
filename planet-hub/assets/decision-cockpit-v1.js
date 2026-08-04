(() => {
  'use strict';

  const HANDOFF_KEY = 'pmh:attention-handoff:v1';
  const HANDOFF_TTL_MS = 30 * 60 * 1000;

  const ATTENTION_TYPES = {
    follow_up: { icon: '📣', label: 'Cobrança', tone: 'follow-up' },
    approval: { icon: '✅', label: 'Aprovação', tone: 'approval' },
    decision: { icon: '🧭', label: 'Decisão', tone: 'decision' },
    execution: { icon: '🎯', label: 'Execução', tone: 'execution' },
    risk: { icon: '⚠️', label: 'Risco', tone: 'risk' },
    campaign: { icon: '📣', label: 'Campanha', tone: 'campaign' },
    inauguration: { icon: '🚀', label: 'Inauguração', tone: 'inauguration' },
  };

  let snapshot = null;
  let syncing = false;
  let lastMarkup = '';
  let handoff = readHandoff();
  let openTimer = 0;

  const radar = () => window.PMHRadarData;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const attrValue = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const isHome = () => normalize(document.querySelector('[data-title]')?.textContent)
    .includes('painel de marketing');

  const responsibleMissing = (item) => !item?.responsible
    || /não definido|sem responsável/i.test(item.responsible);

  const statusMatches = (item, pattern) => pattern.test(String(item?.status || ''));
  const isDeferred = (item) => (item.operationalState || 'actionable') !== 'actionable';
  const followUpDiff = (item) => item.followUpDate ? radar().dayDiff(item.followUpDate) : null;
  const followUpDue = (item) => isDeferred(item) && followUpDiff(item) != null && followUpDiff(item) <= 0;
  const dueBucket = (item) => radar().dueMeta(item.dueDate).bucket;

  function readHandoff() {
    try {
      const value = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || 'null');
      if (!value?.itemId || Date.now() - Number(value.createdAt || 0) > HANDOFF_TTL_MS) {
        sessionStorage.removeItem(HANDOFF_KEY);
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  const saveHandoff = (value) => {
    handoff = value;
    try {
      if (value) sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      // A navegação continua funcionando mesmo sem sessionStorage.
    }
  };

  const focusScore = (item) => {
    const due = radar().dueMeta(item.dueDate);
    const activeCampaignWithoutMilestone = item.action === 'calendario'
      && statusMatches(item, /ativa/i)
      && (!item.context || item.context === 'Campanha do calendário');

    let score = Number(item.priority || 2) * 30;
    if (activeCampaignWithoutMilestone) score -= 2600;
    else if (due.bucket === 'late') score += -10000 + due.weight;
    else if (due.bucket === 'today') score -= 8000;
    else if (due.bucket === 'week') score += -5000 + (due.weight * 20);
    else if (due.bucket === 'later') score += due.weight * 100;
    else score += 1200;

    if (statusMatches(item, /aprova/i)) score -= 650;
    if (item.action === 'inauguracoes' && ['late', 'today', 'week'].includes(due.bucket)) score -= 450;
    if (responsibleMissing(item)) score -= 120;
    return score;
  };

  const attentionType = (item) => {
    if (followUpDue(item)) return 'follow_up';
    if (isDeferred(item)) return 'risk';
    if (statusMatches(item, /aprova/i)) return 'approval';
    if (responsibleMissing(item)) return 'decision';
    if (item.action === 'inauguracoes') return 'inauguration';
    if (item.action === 'calendario' && statusMatches(item, /ativa|produ|planeja/i)) return 'campaign';
    return 'execution';
  };

  const shouldSurface = (item, type) => {
    const bucket = dueBucket(item);
    if (type === 'follow_up') return true;
    if (type === 'risk') {
      return !item.followUpDate && (['late', 'today'].includes(bucket) || !item.blockerReason || !item.dependsOn);
    }
    if (type === 'approval' || type === 'decision') return true;
    if (type === 'inauguration') return ['late', 'today', 'week'].includes(bucket);
    if (type === 'campaign') return statusMatches(item, /ativa|aprova/i) || ['today', 'week'].includes(bucket);
    return ['late', 'today', 'week'].includes(bucket) || Number(item.priority || 2) <= 1;
  };

  const attentionScore = (item, type) => {
    if (type === 'follow_up') return -16000 + (followUpDiff(item) || 0);
    if (type === 'risk') return -7200 + focusScore(item) / 100;
    if (type === 'approval') return focusScore(item) - 1200;
    if (type === 'decision') return focusScore(item) - 850;
    if (type === 'inauguration') return focusScore(item) - 450;
    if (type === 'campaign') return focusScore(item) - 180;
    return focusScore(item);
  };

  const executionReason = (item, type) => {
    const due = radar().dueMeta(item.dueDate);
    const reasons = [];

    if (type === 'follow_up') {
      const dependency = item.dependsOn ? `Depende de ${item.dependsOn}.` : 'Existe uma dependência registrada.';
      const reason = item.blockerReason ? ` ${item.blockerReason}` : '';
      return `${dependency}${reason} A data definida para cobrar ou revisar chegou.`;
    }

    if (type === 'risk') {
      const pieces = [
        item.dependsOn ? `Depende de ${item.dependsOn}.` : 'Existe uma dependência.',
        item.blockerReason || 'O motivo ainda não está explicado com clareza.',
        !item.followUpDate ? 'Ainda não há data para revisar ou cobrar.' : '',
      ].filter(Boolean);
      return pieces.join(' ');
    }

    if (due.bucket === 'late') reasons.push(`${due.label}.`);
    else if (due.bucket === 'today') reasons.push('Vence hoje.');
    else if (due.bucket === 'week') reasons.push(`${due.label}.`);

    if (type === 'approval') reasons.push('Está em aprovação e pode avançar com uma decisão objetiva.');
    if (type === 'decision') reasons.push('Ainda não há responsável definido, então o fluxo não tem dono.');
    if (type === 'inauguration') reasons.push('A data da inauguração está próxima e o checklist ainda possui pendências.');
    if (type === 'campaign' && statusMatches(item, /ativa/i)) reasons.push('A campanha está ativa e precisa ter o próximo marco sob controle.');

    return reasons.join(' ') || 'É o item mais importante agora pela combinação de prioridade, prazo e possibilidade real de avanço.';
  };

  const nextActionFor = (item, type) => {
    if (type === 'follow_up') {
      return `Cobrar ${item.dependsOn || item.responsible || 'a pessoa responsável'} e registrar uma nova previsão.`;
    }
    if (type === 'risk') return 'Completar o contexto, definir de quem depende e marcar uma data de acompanhamento.';
    if (item.nextAction) return item.nextAction;
    if (type === 'decision') return 'Definir quem assume e registrar o próximo passo.';
    if (type === 'approval') return 'Abrir, revisar e aprovar ou devolver com um ajuste objetivo.';

    return ({
      chamados: 'Abrir o chamado, ler a última interação e responder com o próximo passo.',
      inauguracoes: 'Abrir a implantação e concluir a próxima etapa pendente.',
      conteudos: 'Abrir o conteúdo e avançar para a próxima etapa do fluxo.',
      calendario: 'Abrir a campanha e validar o próximo marco.',
      demand: 'Abrir a demanda e executar o próximo passo definido.',
    }[item.action] || 'Abrir o item e definir o próximo movimento concreto.');
  };

  const buildAttention = (item) => {
    const type = attentionType(item);
    return {
      type,
      item,
      score: attentionScore(item, type),
      reason: executionReason(item, type),
      nextAction: nextActionFor(item, type),
    };
  };

  const attentionQueue = (items) => {
    const candidates = items
      .map(buildAttention)
      .filter((entry) => shouldSurface(entry.item, entry.type))
      .sort((a, b) => a.score - b.score);

    if (candidates.length) return candidates;

    const fallback = items
      .filter((item) => !isDeferred(item))
      .sort((a, b) => focusScore(a) - focusScore(b))[0];
    return fallback ? [buildAttention(fallback)] : [];
  };

  const signals = (items) => ({
    late: items.filter((item) => radar().dueMeta(item.dueDate).bucket === 'late').length,
    executable: items.filter((item) => !isDeferred(item)).length,
    dependencies: items.filter(isDeferred).length,
    followUps: items.filter(followUpDue).length,
    approvals: items.filter((item) => statusMatches(item, /aprova/i) && !isDeferred(item)).length,
  });

  const signal = (value, label, tone = '') => `<span class="${esc(tone)}"><b>${esc(value)}</b>${esc(label)}</span>`;

  const nearestFollowUp = (items) => items
    .filter((item) => isDeferred(item) && item.followUpDate)
    .sort((a, b) => String(a.followUpDate).localeCompare(String(b.followUpDate)))[0] || null;

  const typeMeta = (type) => ATTENTION_TYPES[type] || ATTENTION_TYPES.execution;

  const queueCard = (entry) => {
    const meta = typeMeta(entry.type);
    const dueValue = entry.type === 'follow_up' ? entry.item.followUpDate : entry.item.dueDate;
    const due = radar().dueMeta(dueValue);
    return `<button type="button" class="pmh-attention-card tone-${esc(meta.tone)}" data-attention-open="${esc(entry.item.id)}">
      <span class="pmh-attention-kind">${esc(meta.icon)} ${esc(meta.label)}</span>
      <strong>${esc(entry.item.title)}</strong>
      <small>${esc(entry.reason)}</small>
      <footer><span>${esc(entry.item.origin)}</span><time class="${esc(due.tone)}">${esc(due.label)}</time></footer>
    </button>`;
  };

  const emptyMarkup = (items) => {
    const summary = signals(items);
    const next = nearestFollowUp(items);
    const nextLabel = next?.followUpDate
      ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${next.followUpDate}T12:00:00`))
      : '';

    return `<div class="pmh-decision-top">
      <div class="pmh-decision-main">
        <small>🟢 O QUE PRECISA DA SUA ATENÇÃO AGORA</small>
        <h2>Nada executável exige ação imediata</h2>
        <p>${summary.dependencies ? `${summary.dependencies} item(ns) dependem de informação, aprovação ou retorno externo.` : 'O Radar não encontrou nenhuma pendência ativa.'}</p>
        ${next ? `<div class="pmh-decision-next"><small>PRÓXIMO ACOMPANHAMENTO</small><strong>${esc(next.title)} · ${esc(nextLabel)}</strong></div>` : ''}
      </div>
      ${next ? `<div class="pmh-decision-actions"><button type="button" data-radar-context="${esc(next.id)}">Revisar dependência</button></div>` : ''}
    </div>
    <div class="pmh-decision-signals">
      ${signal(summary.executable, ' executáveis')}
      ${signal(summary.dependencies, ' com dependência', summary.dependencies ? 'warning' : '')}
      ${signal(summary.followUps, ' cobranças vencidas', summary.followUps ? 'danger' : '')}
    </div>`;
  };

  const markup = (items) => {
    const queue = attentionQueue(items);
    const decision = queue[0];
    if (!decision) return emptyMarkup(items);

    const { item, reason, nextAction: movement, type } = decision;
    const meta = typeMeta(type);
    const due = radar().dueMeta(type === 'follow_up' ? item.followUpDate : item.dueDate);
    const summary = signals(items);
    const canPrepareMessage = type === 'follow_up' || (item.responsible
      && !/não definido|sem responsável|andré|andre/i.test(item.responsible));
    const secondary = queue.slice(1, 4);

    return `<div class="pmh-decision-top">
      <div class="pmh-decision-main">
        <small>🤖 O QUE PRECISA DA SUA ATENÇÃO AGORA</small>
        <div class="pmh-decision-kind tone-${esc(meta.tone)}">${esc(meta.icon)} ${esc(meta.label)}</div>
        <h2>${esc(item.title)}</h2>
        <p>${esc(reason)}</p>
        <div class="pmh-decision-next"><small>PRÓXIMO MOVIMENTO</small><strong>${esc(movement)}</strong></div>
        <div class="pmh-decision-meta">
          <span class="pmh-active-origin tone-${esc(item.originTone)}">${esc(item.origin)}</span>
          <span>${esc(item.dependsOn || item.responsible || 'Sem responsável')}</span>
          <time class="${esc(due.tone)}">${esc(due.label)}</time>
        </div>
      </div>
      <div class="pmh-decision-actions">
        <button type="button" class="primary" data-attention-open="${esc(item.id)}">Abrir direto na tarefa</button>
        <button type="button" data-radar-context="${esc(item.id)}">${isDeferred(item) ? 'Editar dependência' : 'Adicionar contexto'}</button>
        <button type="button" data-analyze-radar>Analisar contexto</button>
        ${canPrepareMessage ? `<button type="button" data-copy-follow-up data-title="${esc(item.title)}" data-responsible="${esc(item.dependsOn || item.responsible)}" data-reason="${esc(item.blockerReason || reason)}">Preparar cobrança</button>` : ''}
      </div>
    </div>
    ${secondary.length ? `<section class="pmh-attention-queue"><header><small>OUTROS PONTOS QUE MERECEM ATENÇÃO</small><span>Clique para abrir a tarefa com o resumo</span></header><div>${secondary.map(queueCard).join('')}</div></section>` : ''}
    <div class="pmh-decision-signals" aria-label="Leitura rápida do Radar">
      ${signal(summary.executable, ' executáveis')}
      ${signal(summary.dependencies, ' com dependência', summary.dependencies ? 'warning' : '')}
      ${signal(summary.followUps, ' cobranças vencidas', summary.followUps ? 'danger' : '')}
      ${signal(summary.late, ' atrasadas')}
      ${signal(summary.approvals, ' aprovações executáveis')}
    </div>`;
  };

  const render = () => {
    if (!isHome() || !snapshot || !radar()) return;
    const active = document.querySelector('[data-active-workstream]');
    if (!active) return;

    let cockpit = document.querySelector('[data-decision-cockpit]');
    if (!cockpit) {
      cockpit = document.createElement('section');
      cockpit.dataset.decisionCockpit = '1';
      cockpit.className = 'pmh-decision-cockpit';
      active.insertAdjacentElement('beforebegin', cockpit);
    }

    const nextMarkup = markup(Array.isArray(snapshot.items) ? snapshot.items : []);
    if (nextMarkup === lastMarkup && cockpit.innerHTML) return;
    lastMarkup = nextMarkup;
    cockpit.innerHTML = nextMarkup;
  };

  const sync = async () => {
    if (syncing || !isHome() || !radar()) return;
    syncing = true;
    try {
      snapshot = radar().getSnapshot() || await radar().collect();
      render();
    } catch {
      // A fila operacional já mostra o erro das fontes. O cockpit permanece silencioso.
    } finally {
      syncing = false;
    }
  };

  const copyFollowUp = async (button) => {
    const responsible = button.dataset.responsible || '';
    const title = button.dataset.title || '';
    const reason = button.dataset.reason || '';
    const text = `Oi, ${responsible}. Sobre “${title}”: ${reason} Consegue me confirmar o que falta e uma previsão para liberarmos essa demanda?`;

    try {
      await navigator.clipboard.writeText(text);
      const original = button.textContent;
      button.textContent = 'Cobrança copiada ✓';
      setTimeout(() => { button.textContent = original; }, 1600);
    } catch {
      alert(text);
    }
  };

  const findItem = (itemId) => snapshot?.items?.find((item) => item.id === itemId)
    || radar()?.getSnapshot()?.items?.find((item) => item.id === itemId)
    || null;

  const routeTriggerFor = (item) => {
    if (!item || item.action === 'demand') return null;
    const selector = `[data-view="${attrValue(item.action)}"]`;
    return [...document.querySelectorAll(selector)]
      .find((element) => !element.closest('[data-decision-cockpit], [data-attention-handoff]')) || null;
  };

  const exactSelectorFor = (item) => {
    const id = attrValue(item.sourceId);
    if (item.action === 'chamados') return `.pmh-ticket[data-ticket-id="${id}"]`;
    if (item.action === 'calendario') return `[data-edit-campaign="${id}"]`;
    if (item.action === 'conteudos') return `[data-content-edit="${id}"]`;
    if (item.action === 'demand') return `[data-demand-edit="${id}"]`;
    return '';
  };

  const highlightByTitle = (item) => {
    const targetTitle = normalize(item.title);
    if (!targetTitle) return false;
    const candidates = [...document.querySelectorAll('article, button, section')]
      .filter((element) => !element.closest('[data-decision-cockpit], [data-attention-handoff]'));
    const target = candidates.find((element) => normalize(element.textContent).includes(targetTitle));
    if (!target) return false;
    target.classList.add('pmh-attention-target');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => target.classList.remove('pmh-attention-target'), 3200);
    return true;
  };

  const renderHandoff = () => {
    document.querySelector('[data-attention-handoff]')?.remove();
    if (!handoff) return;

    const meta = typeMeta(handoff.type);
    const card = document.createElement('aside');
    card.className = `pmh-attention-handoff tone-${meta.tone}`;
    card.dataset.attentionHandoff = '1';
    card.innerHTML = `<header><span>${esc(meta.icon)} ${esc(meta.label)}</span><button type="button" data-attention-close aria-label="Fechar">×</button></header>
      <strong>${esc(handoff.title)}</strong>
      <p>${esc(handoff.reason)}</p>
      <div><small>PRÓXIMO MOVIMENTO</small><b>${esc(handoff.nextAction)}</b></div>
      <footer>
        <button type="button" data-attention-context="${esc(handoff.itemId)}">Editar contexto</button>
        <button type="button" class="primary" data-attention-reopen>Reabrir tarefa</button>
      </footer>`;
    document.body.appendChild(card);
  };

  const clearHandoff = () => {
    clearTimeout(openTimer);
    openTimer = 0;
    saveHandoff(null);
    renderHandoff();
  };

  const tryOpenExact = (item, attempt = 0) => {
    clearTimeout(openTimer);
    const selector = exactSelectorFor(item);
    const target = selector ? document.querySelector(selector) : null;

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('pmh-attention-target');
      window.setTimeout(() => {
        target.click();
        window.setTimeout(() => target.classList.remove('pmh-attention-target'), 2600);
      }, 180);
      return;
    }

    if (!selector && attempt >= 6 && highlightByTitle(item)) return;
    if (attempt >= 40) {
      highlightByTitle(item);
      return;
    }
    openTimer = window.setTimeout(() => tryOpenExact(item, attempt + 1), 100);
  };

  const openAttention = (itemId) => {
    const item = findItem(itemId);
    if (!item) return;
    const entry = buildAttention(item);
    saveHandoff({
      itemId: item.id,
      sourceId: item.sourceId,
      action: item.action,
      title: item.title,
      origin: item.origin,
      type: entry.type,
      reason: entry.reason,
      nextAction: entry.nextAction,
      createdAt: Date.now(),
    });
    renderHandoff();

    const route = routeTriggerFor(item);
    if (route) route.click();
    tryOpenExact(item);
  };

  window.addEventListener('pmh:radar-data', (event) => {
    snapshot = event.detail;
    render();
  });

  document.addEventListener('click', (event) => {
    const attention = event.target.closest('[data-attention-open]');
    if (attention) {
      event.preventDefault();
      event.stopPropagation();
      openAttention(attention.dataset.attentionOpen);
      return;
    }

    const button = event.target.closest('[data-copy-follow-up]');
    if (button) {
      copyFollowUp(button);
      return;
    }

    if (event.target.closest('[data-attention-close]')) {
      clearHandoff();
      return;
    }

    const context = event.target.closest('[data-attention-context]');
    if (context) {
      window.PMHRadarContext?.open(context.dataset.attentionContext);
      return;
    }

    if (event.target.closest('[data-attention-reopen]') && handoff) {
      openAttention(handoff.itemId);
    }
  }, true);

  let timer = 0;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      sync();
      if (handoff && !document.querySelector('[data-attention-handoff]')) renderHandoff();
    }, 40);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('hashchange', () => {
    lastMarkup = '';
    sync();
    if (handoff) renderHandoff();
  });

  renderHandoff();
  sync();
})();
