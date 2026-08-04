(() => {
  'use strict';

  const API = '/api/hub/radar-contextos';
  const STATES = {
    actionable: 'Posso agir agora',
    blocked: 'Bloqueado por alguém ou setor',
    waiting_info: 'Aguardando informação ou material',
    waiting_approval: 'Aguardando aprovação',
    scheduled: 'Retomar em outra data',
  };

  const radar = () => window.PMHRadarData;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const getItem = (itemId) => radar()?.getSnapshot()?.items?.find((item) => item.id === itemId) || null;

  const apiJson = async (options = {}) => {
    const response = await fetch(API, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const close = () => {
    const modal = document.querySelector('[data-radar-context-modal]');
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 160);
  };

  const fieldsFor = (item) => ({
    state: item?.operationalState || 'actionable',
    reason: item?.blockerReason || '',
    dependsOn: item?.dependsOn || '',
    nextAction: item?.nextAction || '',
    followUpDate: item?.followUpDate || '',
  });

  const suggestionMarkup = (item) => {
    const suggestion = item?.contextSuggestion;
    if (!suggestion) return '';
    const confidence = suggestion.confidence === 'high' ? 'Sinal claro' : 'Vale conferir';
    return `<section class="pmh-radar-suggestion wide">
      <div>
        <small>💡 SUGESTÃO DO RADAR · ${esc(confidence)}</small>
        <strong>${esc(STATES[suggestion.state] || 'Contexto sugerido')}</strong>
        <p>${esc(suggestion.reason)}</p>
        <span>Fonte: ${esc(suggestion.source || item.origin)}${suggestion.dependsOn ? ` · Depende de ${esc(suggestion.dependsOn)}` : ''}</span>
      </div>
      <button type="button" data-apply-context-suggestion>Usar sugestão</button>
    </section>`;
  };

  const open = (itemId) => {
    const item = getItem(itemId);
    if (!item) return;

    document.querySelector('[data-radar-context-modal]')?.remove();
    const values = fieldsFor(item);
    const modal = document.createElement('div');
    modal.className = 'pmh-radar-context-modal';
    modal.dataset.radarContextModal = '1';
    modal.innerHTML = `<form class="pmh-radar-context-dialog" data-radar-context-form data-item-id="${esc(item.id)}">
      <header>
        <div><small>CONTEXTO OPERACIONAL</small><h2>${esc(item.title)}</h2><p>Explique por que esse item está parado. O Radar usará isso para não confundir atraso com trabalho executável.</p></div>
        <button type="button" data-radar-context-close aria-label="Fechar">×</button>
      </header>
      <main>
        ${suggestionMarkup(item)}
        <label class="wide">Situação real
          <select name="state">
            ${Object.entries(STATES).map(([value, label]) => `<option value="${esc(value)}" ${values.state === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}
          </select>
        </label>
        <label class="wide">Por que está parado?
          <textarea name="reason" maxlength="1200" placeholder="Ex.: o franqueado ainda precisa pesquisar e enviar os preços praticados na região.">${esc(values.reason)}</textarea>
        </label>
        <label>Depende de quem ou do quê?
          <input name="dependsOn" maxlength="240" value="${esc(values.dependsOn)}" placeholder="Ex.: franqueado, financeiro, fornecedor">
        </label>
        <label>Revisar ou cobrar em
          <input name="followUpDate" type="date" value="${esc(values.followUpDate)}">
        </label>
        <label class="wide">Próximo movimento quando liberar
          <input name="nextAction" maxlength="700" value="${esc(values.nextAction)}" placeholder="Ex.: receber preços, revisar margens e montar o cardápio">
        </label>
        <aside><strong>Como isso muda o foco?</strong><span>Itens bloqueados deixam de disputar o foco de execução. Eles entram na fila de acompanhamento e voltam a chamar atenção na data escolhida.</span></aside>
      </main>
      <footer>
        <button type="button" class="danger" data-radar-context-clear ${values.state === 'actionable' && !values.reason && !values.dependsOn && !values.nextAction && !values.followUpDate ? 'hidden' : ''}>Limpar contexto</button>
        <span></span>
        <button type="button" data-radar-context-close>Cancelar</button>
        <button type="submit" class="primary">Salvar contexto</button>
      </footer>
    </form>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));
  };

  const applySuggestion = (form) => {
    const item = getItem(form?.dataset.itemId);
    const suggestion = item?.contextSuggestion;
    if (!form || !suggestion) return;

    form.elements.state.value = suggestion.state || 'actionable';
    form.elements.reason.value = suggestion.reason || '';
    form.elements.dependsOn.value = suggestion.dependsOn || '';
    form.elements.nextAction.value = suggestion.nextAction || '';
    form.elements.reason.focus();

    const button = form.querySelector('[data-apply-context-suggestion]');
    if (button) {
      button.textContent = 'Sugestão aplicada ✓';
      button.disabled = true;
    }
  };

  const refreshRadar = async () => {
    radar()?.invalidate();
    await radar()?.collect({ force: true });
  };

  const save = async (form) => {
    const button = form.querySelector('[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    const itemId = form.dataset.itemId;
    if (!itemId) return;

    if (values.state !== 'actionable' && !String(values.reason || '').trim()) {
      alert('Explique por que o item está parado.');
      form.elements.reason?.focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Salvando…';
    try {
      await apiJson({
        method: 'PUT',
        body: JSON.stringify({ itemId, ...values }),
      });
      close();
      await refreshRadar();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível salvar o contexto.');
      button.disabled = false;
      button.textContent = 'Salvar contexto';
    }
  };

  const clear = async (form) => {
    const itemId = form.dataset.itemId;
    if (!itemId) return;
    const button = form.querySelector('[data-radar-context-clear]');
    button.disabled = true;
    button.textContent = 'Limpando…';
    try {
      await apiJson({ method: 'DELETE', body: JSON.stringify({ itemId }) });
      close();
      await refreshRadar();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível limpar o contexto.');
      button.disabled = false;
      button.textContent = 'Limpar contexto';
    }
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-radar-context]');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      return open(trigger.dataset.radarContext);
    }

    const suggestion = event.target.closest('[data-apply-context-suggestion]');
    if (suggestion) return applySuggestion(suggestion.closest('[data-radar-context-form]'));

    if (event.target.closest('[data-radar-context-close]') || event.target.matches('[data-radar-context-modal]')) {
      return close();
    }

    const clearButton = event.target.closest('[data-radar-context-clear]');
    if (clearButton) return clear(clearButton.closest('[data-radar-context-form]'));
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-radar-context-form]');
    if (!form) return;
    event.preventDefault();
    save(form);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  window.PMHRadarContext = Object.freeze({ open });
})();
