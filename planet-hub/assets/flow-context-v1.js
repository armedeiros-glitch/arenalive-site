(() => {
  'use strict';

  const API = '/api/hub/contexto-operacional';
  const STATE_LABELS = {
    ready: 'Nas nossas mãos',
    waiting_external: 'Aguardando terceiro',
    waiting_internal: 'Aguardando interno',
    waiting_approval: 'Aguardando aprovação',
    blocked: 'Travado',
    unknown: 'Sem contexto',
  };
  const BLOCKER_LABELS = {
    '': 'Não definido',
    franchisee: 'Franqueado',
    supplier: 'Fornecedor',
    shopping: 'Shopping',
    finance: 'Financeiro',
    marketing: 'Marketing',
    internal: 'Outro setor interno',
    other: 'Outro',
  };

  let contexts = {};
  let loaded = false;
  let pending = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

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

  const load = async ({ force = false } = {}) => {
    if (loaded && !force) return contexts;
    if (pending && !force) return pending;

    pending = apiJson()
      .then((payload) => {
        contexts = payload.data && typeof payload.data === 'object' ? payload.data : {};
        loaded = true;
        return contexts;
      })
      .finally(() => { pending = null; });

    return pending;
  };

  const get = (itemId) => contexts[String(itemId || '')] || null;

  const save = async (itemId, context) => {
    const payload = await apiJson({
      method: 'PUT',
      body: JSON.stringify({ itemId, context }),
    });
    if (payload.context) contexts[itemId] = payload.context;
    loaded = true;
    window.dispatchEvent(new CustomEvent('pmh:flow-context-updated', {
      detail: { itemId, context: payload.context || null },
    }));
    return payload.context || null;
  };

  const clear = async (itemId) => {
    await apiJson({ method: 'PUT', body: JSON.stringify({ itemId, clear: true }) });
    delete contexts[itemId];
    loaded = true;
    window.dispatchEvent(new CustomEvent('pmh:flow-context-updated', {
      detail: { itemId, context: null },
    }));
  };

  const options = (labels, selected) => Object.entries(labels)
    .map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`)
    .join('');

  const defaultNextAction = (item, context) => {
    const target = context.nextActor || context.blockerName || 'a pessoa responsável';
    if (context.state === 'waiting_external') return `Cobrar ${target} sobre o que está faltando.`;
    if (context.state === 'waiting_internal') return `Alinhar com ${target} e confirmar o retorno.`;
    if (context.state === 'waiting_approval') return `Solicitar a aprovação de ${target}.`;
    if (context.state === 'blocked') return context.blockerReason
      ? `Resolver o bloqueio: ${context.blockerReason}`
      : 'Identificar como remover o bloqueio.';
    if (context.state === 'ready') return `Abrir “${item.title}” e executar a próxima etapa.`;
    return 'Registrar por que a demanda está parada e definir o próximo movimento.';
  };

  const messageFor = (item, context) => {
    const action = context.nextAction || defaultNextAction(item, context);
    const target = context.nextActor || context.blockerName;
    return [
      target ? `Olá, ${target}!` : 'Olá!',
      `Sobre “${item.title}”: ${action}`,
      context.blockerReason ? `O que está pendente: ${context.blockerReason}` : '',
      'Consegue me atualizar sobre isso?',
    ].filter(Boolean).join('\n\n');
  };

  const closeModal = () => {
    const modal = document.querySelector('[data-flow-modal]');
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 180);
  };

  const open = async (item) => {
    await load().catch(() => ({}));
    document.querySelector('[data-flow-modal]')?.remove();

    const current = get(item.id) || {
      state: 'unknown',
      blockerType: '',
      blockerName: '',
      blockerReason: '',
      nextAction: '',
      nextActor: '',
      followUpDate: '',
      notes: '',
    };

    const modal = document.createElement('div');
    modal.className = 'pmh-flow-modal';
    modal.dataset.flowModal = '1';
    modal.innerHTML = `<form class="pmh-flow-dialog" data-flow-form>
      <header>
        <div><small>CONTEXTO OPERACIONAL</small><h2>${esc(item.title)}</h2><p>${esc(item.origin)} · ${esc(item.context || 'Sem contexto de origem')}</p></div>
        <button type="button" data-flow-close aria-label="Fechar">×</button>
      </header>
      <main>
        <section class="pmh-flow-explainer"><strong>O SULTS mostra o prazo. Aqui registramos por que está parado e quem precisa agir.</strong></section>
        <div class="pmh-flow-grid">
          <label>Estado real<select name="state">${options(STATE_LABELS, current.state || 'unknown')}</select></label>
          <label>Onde está a dependência<select name="blockerType">${options(BLOCKER_LABELS, current.blockerType || '')}</select></label>
          <label>Quem ou qual setor<input name="blockerName" maxlength="180" value="${esc(current.blockerName)}" placeholder="Ex.: Franqueado de Curitiba"></label>
          <label>Quem precisa agir agora<input name="nextActor" maxlength="180" value="${esc(current.nextActor)}" placeholder="Ex.: João, Financeiro, Franqueado"></label>
          <label class="wide">O que está faltando<textarea name="blockerReason" maxlength="1200" placeholder="Ex.: O franqueado ainda não enviou os preços pesquisados na região.">${esc(current.blockerReason)}</textarea></label>
          <label class="wide">Próximo movimento<textarea name="nextAction" maxlength="700" placeholder="Ex.: Cobrar a tabela de preços e revisar o cardápio assim que chegar.">${esc(current.nextAction)}</textarea></label>
          <label>Revisar ou cobrar em<input name="followUpDate" type="date" value="${esc(current.followUpDate)}"></label>
          <label class="wide">Observações<textarea name="notes" maxlength="1200">${esc(current.notes)}</textarea></label>
        </div>
      </main>
      <footer>
        <button type="button" class="danger" data-flow-clear ${get(item.id) ? '' : 'hidden'}>Limpar contexto</button>
        <span></span>
        <button type="button" data-flow-copy>Copiar cobrança</button>
        <button type="button" data-flow-close>Cancelar</button>
        <button type="submit" class="primary">Salvar contexto</button>
      </footer>
    </form>`;
    modal.__item = item;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));
  };

  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-flow-close]') || event.target.matches('[data-flow-modal]')) return closeModal();

    const form = event.target.closest('[data-flow-form]');
    const item = form?.closest('[data-flow-modal]')?.__item;

    if (event.target.closest('[data-flow-copy]') && form && item) {
      const values = Object.fromEntries(new FormData(form));
      const text = messageFor(item, values);
      try {
        await navigator.clipboard.writeText(text);
        const button = event.target.closest('[data-flow-copy]');
        button.textContent = 'Cobrança copiada ✓';
        setTimeout(() => { button.textContent = 'Copiar cobrança'; }, 1600);
      } catch {
        alert('Não foi possível copiar a cobrança.');
      }
      return;
    }

    if (event.target.closest('[data-flow-clear]') && item) {
      if (!confirm('Limpar o contexto operacional desta demanda?')) return;
      const button = event.target.closest('[data-flow-clear]');
      button.disabled = true;
      try {
        await clear(item.id);
        closeModal();
      } catch (error) {
        alert(error instanceof Error ? error.message : 'Não foi possível limpar o contexto.');
        button.disabled = false;
      }
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-flow-form]');
    if (!form) return;
    event.preventDefault();
    const modal = form.closest('[data-flow-modal]');
    const item = modal?.__item;
    if (!item) return;

    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Salvando…';
    try {
      const values = Object.fromEntries(new FormData(form));
      if (!values.nextAction) values.nextAction = defaultNextAction(item, values);
      await save(item.id, values);
      closeModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível salvar o contexto.');
      submit.disabled = false;
      submit.textContent = 'Salvar contexto';
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  window.PMHFlowContext = Object.freeze({
    STATE_LABELS,
    BLOCKER_LABELS,
    load,
    get,
    save,
    clear,
    open,
    messageFor,
    defaultNextAction,
  });
})();
