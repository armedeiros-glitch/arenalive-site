(() => {
  'use strict';

  let snapshot = null;
  let syncing = false;
  let lastMarkup = '';

  const radar = () => window.PMHRadarData;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const isHome = () => normalize(document.querySelector('[data-title]')?.textContent)
    .includes('painel de marketing');

  const responsibleMissing = (item) => !item?.responsible
    || /não definido|sem responsável/i.test(item.responsible);

  const statusMatches = (item, pattern) => pattern.test(String(item?.status || ''));
  const isDeferred = (item) => (item.operationalState || 'actionable') !== 'actionable';
  const followUpDiff = (item) => item.followUpDate ? radar().dayDiff(item.followUpDate) : null;
  const followUpDue = (item) => isDeferred(item) && followUpDiff(item) != null && followUpDiff(item) <= 0;

  const focusScore = (item) => {
    const due = radar().dueMeta(item.dueDate);
    let score = Number(item.priority || 2) * 30;

    if (due.bucket === 'late') score += -10000 + due.weight;
    else if (due.bucket === 'today') score -= 8000;
    else if (due.bucket === 'week') score += -5000 + (due.weight * 20);
    else if (due.bucket === 'later') score += due.weight * 100;
    else score += 1200;

    if (statusMatches(item, /aprova/i)) score -= 650;
    if (item.action === 'inauguracoes' && ['late', 'today', 'week'].includes(due.bucket)) score -= 450;
    if (responsibleMissing(item)) score -= 120;
    return score;
  };

  const executionReason = (item) => {
    const due = radar().dueMeta(item.dueDate);
    const reasons = [];

    if (due.bucket === 'late') reasons.push(`${due.label}.`);
    else if (due.bucket === 'today') reasons.push('Vence hoje.');
    else if (due.bucket === 'week') reasons.push(`${due.label}.`);

    if (statusMatches(item, /aprova/i)) reasons.push('Está parada em aprovação e pode avançar com uma decisão sua.');
    if (item.action === 'inauguracoes' && ['late', 'today', 'week'].includes(due.bucket)) {
      reasons.push('A data da inauguração está próxima.');
    }
    if (responsibleMissing(item)) reasons.push('Ainda não há responsável definido.');

    return reasons.join(' ') || 'É o item executável mais importante pela combinação de prioridade, prazo e atualização.';
  };

  const followUpReason = (item) => {
    const dependency = item.dependsOn ? `Depende de ${item.dependsOn}.` : 'Existe uma dependência externa.';
    const reason = item.blockerReason ? ` ${item.blockerReason}` : '';
    return `${dependency}${reason} A data definida para cobrar ou revisar chegou.`;
  };

  const executionNextAction = (item) => {
    if (item.nextAction) return item.nextAction;
    if (responsibleMissing(item)) return 'Definir quem assume e registrar o próximo passo.';
    if (statusMatches(item, /aprova/i)) return 'Abrir, revisar e aprovar ou devolver com um ajuste objetivo.';

    return ({
      chamados: 'Abrir o chamado, ler a última interação e responder com o próximo passo.',
      inauguracoes: 'Abrir a implantação e concluir a próxima etapa pendente.',
      conteudos: 'Abrir o conteúdo e avançar para a próxima etapa do fluxo.',
      calendario: 'Abrir a campanha e validar o próximo marco.',
      demand: 'Abrir a demanda e executar o próximo passo definido.',
    }[item.action] || 'Abrir o item e definir o próximo movimento concreto.');
  };

  const followUpNextAction = (item) => {
    const target = item.dependsOn || item.responsible || 'a pessoa responsável';
    return `Cobrar ${target} e registrar a nova previsão.`;
  };

  const recommendFocus = (items) => {
    const actionable = items
      .filter((item) => !isDeferred(item))
      .sort((a, b) => focusScore(a) - focusScore(b));

    if (actionable[0]) {
      return {
        type: 'execution',
        item: actionable[0],
        reason: executionReason(actionable[0]),
        nextAction: executionNextAction(actionable[0]),
      };
    }

    const followUps = items
      .filter(followUpDue)
      .sort((a, b) => (followUpDiff(a) ?? 0) - (followUpDiff(b) ?? 0));

    if (followUps[0]) {
      return {
        type: 'follow_up',
        item: followUps[0],
        reason: followUpReason(followUps[0]),
        nextAction: followUpNextAction(followUps[0]),
      };
    }

    return null;
  };

  const signals = (items) => ({
    late: items.filter((item) => radar().dueMeta(item.dueDate).bucket === 'late').length,
    executable: items.filter((item) => !isDeferred(item)).length,
    dependencies: items.filter(isDeferred).length,
    followUps: items.filter(followUpDue).length,
    approvals: items.filter((item) => statusMatches(item, /aprova/i) && !isDeferred(item)).length,
  });

  const actionAttrs = (item) => item.action === 'demand'
    ? `data-demand-edit="${esc(item.sourceId)}"`
    : `data-view="${esc(item.action)}"`;

  const signal = (value, label, tone = '') => `<span class="${esc(tone)}"><b>${esc(value)}</b>${esc(label)}</span>`;

  const nearestFollowUp = (items) => items
    .filter((item) => isDeferred(item) && item.followUpDate)
    .sort((a, b) => String(a.followUpDate).localeCompare(String(b.followUpDate)))[0] || null;

  const emptyMarkup = (items) => {
    const summary = signals(items);
    const next = nearestFollowUp(items);
    const nextLabel = next?.followUpDate
      ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${next.followUpDate}T12:00:00`))
      : '';

    return `<div class="pmh-decision-top">
      <div class="pmh-decision-main">
        <small>🟢 SEM EXECUÇÃO DISPONÍVEL</small>
        <h2>Nenhum item pode avançar agora</h2>
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
    const decision = recommendFocus(items);
    if (!decision) return emptyMarkup(items);

    const { item, reason, nextAction: movement, type } = decision;
    const due = radar().dueMeta(type === 'follow_up' ? item.followUpDate : item.dueDate);
    const summary = signals(items);
    const canPrepareMessage = type === 'follow_up' || (item.responsible
      && !/não definido|sem responsável|andré|andre/i.test(item.responsible));

    return `<div class="pmh-decision-top">
      <div class="pmh-decision-main">
        <small>${type === 'follow_up' ? '📣 COBRANÇA NECESSÁRIA AGORA' : '🎯 FOCO PRINCIPAL AGORA'}</small>
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
        <button type="button" class="primary" ${actionAttrs(item)}>${type === 'follow_up' ? 'Abrir item' : 'Abrir foco'}</button>
        <button type="button" data-radar-context="${esc(item.id)}">${isDeferred(item) ? 'Editar dependência' : 'Adicionar contexto'}</button>
        <button type="button" data-analyze-radar>Analisar contexto</button>
        ${canPrepareMessage ? `<button type="button" data-copy-follow-up data-title="${esc(item.title)}" data-responsible="${esc(item.dependsOn || item.responsible)}" data-reason="${esc(item.blockerReason || reason)}">Preparar cobrança</button>` : ''}
      </div>
    </div>
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

  window.addEventListener('pmh:radar-data', (event) => {
    snapshot = event.detail;
    render();
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy-follow-up]');
    if (button) copyFollowUp(button);
  });

  let timer = 0;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(sync, 40);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('hashchange', () => {
    lastMarkup = '';
    sync();
  });
  sync();
})();
