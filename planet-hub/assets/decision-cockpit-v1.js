(() => {
  'use strict';

  let snapshot = null;
  let syncing = false;

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
    if (statusMatches(item, /aguard/i)) score += 350;
    if (responsibleMissing(item)) score -= 120;

    return score;
  };

  const focusReason = (item) => {
    const due = radar().dueMeta(item.dueDate);
    const reasons = [];

    if (due.bucket === 'late') reasons.push(`${due.label}.`);
    else if (due.bucket === 'today') reasons.push('Vence hoje.');
    else if (due.bucket === 'week') reasons.push(`${due.label}.`);

    if (statusMatches(item, /aprova/i)) reasons.push('Está parada em aprovação.');
    if (item.action === 'inauguracoes' && ['late', 'today', 'week'].includes(due.bucket)) {
      reasons.push('A data da inauguração está próxima.');
    }
    if (responsibleMissing(item)) reasons.push('Ainda não há responsável definido.');
    if (statusMatches(item, /aguard/i)) reasons.push('Existe uma dependência aguardando retorno.');

    return reasons.join(' ') || 'É o item mais importante pela combinação de prioridade, prazo e atualização.';
  };

  const nextAction = (item) => {
    if (responsibleMissing(item)) return 'Definir quem assume e registrar o próximo passo.';
    if (statusMatches(item, /aguard/i)) return 'Identificar a dependência e cobrar uma previsão objetiva.';
    if (statusMatches(item, /aprova/i)) return 'Abrir, revisar e aprovar ou devolver com um ajuste objetivo.';

    return ({
      chamados: 'Abrir o chamado, ler a última interação e responder com o próximo passo.',
      inauguracoes: 'Abrir a implantação e concluir a próxima etapa pendente.',
      conteudos: 'Abrir o conteúdo e avançar para a próxima etapa do fluxo.',
      calendario: 'Abrir a campanha e validar o próximo marco.',
      demand: 'Abrir a demanda e executar o próximo passo definido.',
    }[item.action] || 'Abrir o item e definir o próximo movimento concreto.');
  };

  const recommendFocus = (items) => {
    const ranked = [...items].sort((a, b) => {
      const difference = focusScore(a) - focusScore(b);
      if (difference !== 0) return difference;
      return radar().sortItems([a, b])[0] === a ? -1 : 1;
    });
    const item = ranked[0] || null;
    return item ? { item, reason: focusReason(item), nextAction: nextAction(item) } : null;
  };

  const signals = (items) => ({
    late: items.filter((item) => radar().dueMeta(item.dueDate).bucket === 'late').length,
    today: items.filter((item) => radar().dueMeta(item.dueDate).bucket === 'today').length,
    approvals: items.filter((item) => statusMatches(item, /aprova/i)).length,
    waiting: items.filter((item) => statusMatches(item, /aguard/i)).length,
    noResponsible: items.filter(responsibleMissing).length,
  });

  const actionAttrs = (item) => item.action === 'demand'
    ? `data-demand-edit="${esc(item.sourceId)}"`
    : `data-view="${esc(item.action)}"`;

  const signal = (value, label, tone = '') => `<span class="${esc(tone)}"><b>${esc(value)}</b>${esc(label)}</span>`;

  const markup = (items) => {
    const decision = recommendFocus(items);
    if (!decision) {
      return `<div class="pmh-decision-main"><small>AGORA</small><h2>Nenhuma pendência ativa</h2><p>O Radar não encontrou nada que precise de ação neste momento.</p></div>`;
    }

    const { item, reason, nextAction: movement } = decision;
    const due = radar().dueMeta(item.dueDate);
    const summary = signals(items);
    const canPrepareMessage = item.responsible
      && !/não definido|sem responsável|andré|andre/i.test(item.responsible);

    return `<div class="pmh-decision-top">
      <div class="pmh-decision-main">
        <small>🎯 FOCO PRINCIPAL AGORA</small>
        <h2>${esc(item.title)}</h2>
        <p>${esc(reason)}</p>
        <div class="pmh-decision-next"><small>PRÓXIMO MOVIMENTO</small><strong>${esc(movement)}</strong></div>
        <div class="pmh-decision-meta">
          <span class="pmh-active-origin tone-${esc(item.originTone)}">${esc(item.origin)}</span>
          <span>${esc(item.responsible || 'Sem responsável')}</span>
          <time class="${esc(due.tone)}">${esc(due.label)}</time>
        </div>
      </div>
      <div class="pmh-decision-actions">
        <button type="button" class="primary" ${actionAttrs(item)}>Abrir foco</button>
        <button type="button" data-analyze-radar>Analisar contexto</button>
        ${canPrepareMessage ? `<button type="button" data-copy-follow-up data-title="${esc(item.title)}" data-responsible="${esc(item.responsible)}" data-reason="${esc(reason)}">Preparar cobrança</button>` : ''}
      </div>
    </div>
    <div class="pmh-decision-signals" aria-label="Leitura rápida do Radar">
      ${signal(summary.late, ' atrasadas', summary.late ? 'danger' : '')}
      ${signal(summary.today, ' vencem hoje', summary.today ? 'warning' : '')}
      ${signal(summary.approvals, ' em aprovação')}
      ${signal(summary.waiting, ' aguardando')}
      ${signal(summary.noResponsible, ' sem responsável', summary.noResponsible ? 'warning' : '')}
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

    cockpit.innerHTML = markup(Array.isArray(snapshot.items) ? snapshot.items : []);
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
    const text = `Oi, ${responsible}. Sobre “${title}”: ${reason} Consegue me confirmar o próximo passo e a previsão de conclusão?`;

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

  window.addEventListener('hashchange', sync);
  sync();
})();
