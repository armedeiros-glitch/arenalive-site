(() => {
  'use strict';

  const API = '/api/hub/planet/five-stars/evaluations';
  const ACTIVE_HASHES = new Set(['5-estrelas', 'cinco-estrelas', '5estrelas']);
  const LIMITS = { commercial: 35, experience: 25, marketing: 20, management: 20 };
  const state = { data: [], loaded: false, loading: null, error: '', editingId: '' };
  let frame = 0;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const hash = () => String(location.hash || '').replace(/^#/, '').toLowerCase();
  const active = () => ACTIVE_HASHES.has(hash());
  const page = () => document.querySelector('[data-p5-page]');
  const tabContent = () => page()?.querySelector('[data-p5-content]');
  const normalizeUnit = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const starsText = (count) => '★'.repeat(count) + '☆'.repeat(5 - count);
  const scoreStars = (total) => total >= 90 ? 5 : total >= 75 ? 4 : total >= 60 ? 3 : total >= 40 ? 2 : 1;
  const totalScore = (scores = {}) => Math.round((number(scores.commercial) + number(scores.experience) + number(scores.marketing) + number(scores.management)) * 10) / 10;
  const cycleLabel = (cycle) => {
    const match = String(cycle || '').match(/^(\d{4})-S([12])$/);
    return match ? `${match[2]}º semestre de ${match[1]}` : String(cycle || 'Ciclo não informado');
  };
  const formatDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'Sem data';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  };
  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const currentCycle = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric',
    }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value || new Date().getFullYear());
    const month = Number(parts.find((part) => part.type === 'month')?.value || 1);
    return `${year}-S${month <= 6 ? 1 : 2}`;
  };
  const cycleOptions = (selected = '') => {
    const current = currentCycle();
    const [yearText, semesterText] = current.split('-S');
    const year = Number(yearText);
    const semester = Number(semesterText);
    const options = [];
    for (let offset = -4; offset <= 2; offset += 1) {
      const absolute = year * 2 + (semester - 1) + offset;
      const optionYear = Math.floor(absolute / 2);
      const optionSemester = (absolute % 2) + 1;
      const value = `${optionYear}-S${optionSemester}`;
      options.push(`<option value="${value}" ${value === (selected || current) ? 'selected' : ''}>${cycleLabel(value)}</option>`);
    }
    return options.reverse().join('');
  };

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

  const load = async (force = false) => {
    if (state.loading) return state.loading;
    if (state.loaded && !force) return state.data;
    state.loading = apiJson().then((payload) => {
      state.data = Array.isArray(payload.data) ? payload.data : [];
      state.loaded = true;
      state.error = '';
      return state.data;
    }).catch((error) => {
      state.error = error instanceof Error ? error.message : String(error);
      state.loaded = true;
      return state.data;
    }).finally(() => { state.loading = null; });
    return state.loading;
  };

  const sorted = () => [...state.data].sort((a, b) => {
    const cycleCompare = String(b.cycle || '').localeCompare(String(a.cycle || ''));
    if (cycleCompare) return cycleCompare;
    return String(b.evaluatedAt || '').localeCompare(String(a.evaluatedAt || ''));
  });

  const previousHighCycle = (evaluation) => {
    if (!evaluation?.unit || number(evaluation.total) < 90) return false;
    const key = normalizeUnit(evaluation.unit);
    const previous = state.data
      .filter((item) => normalizeUnit(item.unit) === key && item.id !== evaluation.id && String(item.cycle || '') < String(evaluation.cycle || ''))
      .sort((a, b) => String(b.cycle || '').localeCompare(String(a.cycle || '')))[0];
    return Boolean(previous && number(previous.total) >= 90);
  };

  const fiveStarState = (evaluation) => {
    if (number(evaluation.total) < 90) return { ready: false, pending: [] };
    const pending = [];
    if (evaluation?.requirements?.hiddenShopper !== 'ok') pending.push('cliente oculto');
    if (evaluation?.requirements?.reportsOnTime !== 'ok') pending.push('DRE e fluxos');
    if (evaluation?.requirements?.noSeriousPending !== 'ok') pending.push('pendências graves');
    if (!previousHighCycle(evaluation)) pending.push('2 ciclos consecutivos');
    return { ready: pending.length === 0, pending };
  };

  const latestByUnit = () => {
    const map = new Map();
    sorted().forEach((item) => {
      const key = normalizeUnit(item.unit);
      if (key && !map.has(key)) map.set(key, item);
    });
    return [...map.values()].sort((a, b) => String(a.unit).localeCompare(String(b.unit), 'pt-BR'));
  };

  const decorateHeader = () => {
    const root = page();
    const intro = root?.querySelector('.p5-intro');
    if (!intro || intro.querySelector('[data-p5-new-evaluation]')) return;
    const status = intro.querySelector('.p5-source-status');
    const actions = document.createElement('div');
    actions.className = 'p5-data-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'p5-new-evaluation-button';
    button.dataset.p5NewEvaluation = 'true';
    button.textContent = '+ Nova avaliação';
    actions.appendChild(button);
    if (status) actions.appendChild(status);
    intro.appendChild(actions);
  };

  const updateKpis = () => {
    const root = page();
    const cards = root?.querySelectorAll('.p5-kpis article');
    if (!cards || cards.length < 4) return;
    if (!state.loaded || state.error) return;
    const units = latestByUnit();
    const average = units.length ? Math.round((units.reduce((sum, item) => sum + number(item.total), 0) / units.length) * 10) / 10 : null;
    const fiveStars = units.filter((item) => fiveStarState(item).ready).length;
    const evolving = units.filter((item) => number(item.starsByScore) <= 2).length;
    const values = [
      [average === null ? '—' : average.toLocaleString('pt-BR'), units.length ? 'pontos na avaliação mais recente' : 'aguardando avaliações reais'],
      [String(units.length), units.length === 1 ? 'unidade com avaliação' : 'unidades com avaliação'],
      [String(fiveStars), 'requisitos completos no ciclo atual'],
      [String(evolving), 'classificações 1 e 2 estrelas'],
    ];
    cards.forEach((card, index) => {
      const strong = card.querySelector('strong');
      const span = card.querySelector('span');
      if (strong) strong.textContent = values[index][0];
      if (span) span.textContent = values[index][1];
    });
  };

  const statusMarkup = (item) => {
    const starCount = scoreStars(number(item.total));
    if (starCount < 5) return `<span class="p5-eval-status">${starsText(starCount)}</span>`;
    const gate = fiveStarState(item);
    return gate.ready
      ? '<span class="p5-eval-status ready">★★★★★ 5 estrelas</span>'
      : `<span class="p5-eval-status pending">★★★★★ faixa · certificação pendente</span>`;
  };

  const unitsMarkup = () => {
    if (state.error) return `<section class="p5-panel p5-data-empty"><strong>Não consegui carregar as avaliações.</strong><span>${esc(state.error)}</span><button type="button" data-p5-reload>Atualizar</button></section>`;
    const units = latestByUnit();
    if (!units.length) return `<section class="p5-panel p5-data-empty"><div class="p5-empty-icon">☆</div><strong>Nenhuma unidade avaliada ainda</strong><span>Clique em Nova avaliação. Você informa só a unidade, o ciclo e os quatro pilares.</span><button type="button" data-p5-new-evaluation>+ Lançar primeira avaliação</button></section>`;
    return `<section class="p5-data-stack">
      <header class="p5-data-section-header"><div><small>UNIDADES</small><h3>Última fotografia de cada unidade</h3></div><span>${units.length} ${units.length === 1 ? 'unidade' : 'unidades'}</span></header>
      <div class="p5-unit-list">${units.map((item) => {
        const history = state.data.filter((evaluation) => normalizeUnit(evaluation.unit) === normalizeUnit(item.unit)).sort((a, b) => String(b.cycle).localeCompare(String(a.cycle)));
        const previous = history[1];
        const delta = previous ? Math.round((number(item.total) - number(previous.total)) * 10) / 10 : null;
        return `<article class="p5-unit-row">
          <div class="p5-unit-main"><small>${esc(cycleLabel(item.cycle))}</small><strong>${esc(item.unit)}</strong><span>${formatDate(item.evaluatedAt)}</span></div>
          <div class="p5-unit-score"><strong>${number(item.total).toLocaleString('pt-BR')}<small>/100</small></strong>${statusMarkup(item)}</div>
          <div class="p5-unit-trend"><small>EVOLUÇÃO</small><strong class="${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}">${delta === null ? '1ª avaliação' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR')} pts`}</strong></div>
          <button type="button" class="p5-row-action" data-p5-edit="${esc(item.id)}">Abrir</button>
        </article>`;
      }).join('')}</div>
    </section>`;
  };

  const evaluationsMarkup = () => {
    if (state.error) return `<section class="p5-panel p5-data-empty"><strong>Não consegui carregar as avaliações.</strong><span>${esc(state.error)}</span><button type="button" data-p5-reload>Atualizar</button></section>`;
    const items = sorted();
    if (!items.length) return unitsMarkup();
    return `<section class="p5-data-stack">
      <header class="p5-data-section-header"><div><small>HISTÓRICO</small><h3>Avaliações registradas</h3><p>Cada novo ciclo fica guardado para mostrar evolução.</p></div><button type="button" data-p5-new-evaluation>+ Nova avaliação</button></header>
      <div class="p5-evaluation-list">${items.map((item) => {
        const gate = fiveStarState(item);
        return `<article class="p5-evaluation-row">
          <div><small>${esc(cycleLabel(item.cycle))} · ${formatDate(item.evaluatedAt)}</small><strong>${esc(item.unit)}</strong>${item.notes ? `<span>${esc(item.notes)}</span>` : ''}</div>
          <div class="p5-evaluation-pillars"><span><small>Comercial</small><b>${number(item.scores?.commercial).toLocaleString('pt-BR')}/35</b></span><span><small>Experiência</small><b>${number(item.scores?.experience).toLocaleString('pt-BR')}/25</b></span><span><small>Marketing</small><b>${number(item.scores?.marketing).toLocaleString('pt-BR')}/20</b></span><span><small>Gestão</small><b>${number(item.scores?.management).toLocaleString('pt-BR')}/20</b></span></div>
          <div class="p5-evaluation-total"><strong>${number(item.total).toLocaleString('pt-BR')}</strong><small>/100</small>${statusMarkup(item)}${number(item.total) >= 90 && !gate.ready ? `<em>Pendente: ${esc(gate.pending.join(', '))}</em>` : ''}</div>
          <div class="p5-evaluation-actions"><button type="button" data-p5-edit="${esc(item.id)}">Editar</button><button type="button" class="danger" data-p5-delete="${esc(item.id)}">Excluir</button></div>
        </article>`;
      }).join('')}</div>
    </section>`;
  };

  const renderActiveTab = () => {
    if (!active()) return;
    decorateHeader();
    updateKpis();
    const root = page();
    const selected = root?.querySelector('[data-p5-tab].active')?.dataset.p5Tab;
    const target = tabContent();
    if (!target) return;
    if (selected === 'units') target.innerHTML = unitsMarkup();
    if (selected === 'evaluations') target.innerHTML = evaluationsMarkup();
  };

  const requirementOptions = (selected, okLabel, failLabel) => `
    <option value="pending" ${selected === 'pending' ? 'selected' : ''}>Ainda não confirmado</option>
    <option value="ok" ${selected === 'ok' ? 'selected' : ''}>${okLabel}</option>
    <option value="fail" ${selected === 'fail' ? 'selected' : ''}>${failLabel}</option>`;

  const openModal = (evaluation = null) => {
    document.querySelector('[data-p5-modal]')?.remove();
    state.editingId = evaluation?.id || '';
    const current = evaluation || {
      unit: '', cycle: currentCycle(), evaluatedAt: today(),
      scores: { commercial: 0, experience: 0, marketing: 0, management: 0 },
      requirements: { hiddenShopper: 'pending', reportsOnTime: 'pending', noSeriousPending: 'pending' },
      notes: '',
    };
    const modal = document.createElement('div');
    modal.className = 'p5-modal-backdrop';
    modal.dataset.p5Modal = 'true';
    modal.innerHTML = `<section class="p5-modal" role="dialog" aria-modal="true" aria-labelledby="p5-modal-title">
      <header><div><small>PLANET 5 ESTRELAS</small><h2 id="p5-modal-title">${evaluation ? 'Editar avaliação' : 'Nova avaliação'}</h2><p>Quatro notas, três confirmações e pronto. O André OS faz a soma e a leitura.</p></div><button type="button" data-p5-close aria-label="Fechar">×</button></header>
      <form data-p5-form>
        <section class="p5-form-basics">
          <label><span>Unidade</span><input name="unit" value="${esc(current.unit)}" maxlength="180" placeholder="Ex.: Patos de Minas" required></label>
          <label><span>Ciclo</span><select name="cycle" required>${cycleOptions(current.cycle)}</select></label>
          <label><span>Data</span><input name="evaluatedAt" type="date" value="${esc(current.evaluatedAt || today())}" required></label>
        </section>
        <section class="p5-score-entry">
          <div class="p5-score-entry-head"><div><small>PONTUAÇÃO</small><h3>Notas por pilar</h3></div><div class="p5-live-total"><strong data-p5-live-total>0</strong><span>/100</span><em data-p5-live-stars>☆☆☆☆☆</em></div></div>
          <div class="p5-score-grid">
            <label><span>Resultado Comercial <b>/35</b></span><input name="commercial" type="number" min="0" max="35" step="0.1" value="${esc(current.scores?.commercial ?? 0)}" required></label>
            <label><span>Experiência do Cliente <b>/25</b></span><input name="experience" type="number" min="0" max="25" step="0.1" value="${esc(current.scores?.experience ?? 0)}" required></label>
            <label><span>Marketing e Participação <b>/20</b></span><input name="marketing" type="number" min="0" max="20" step="0.1" value="${esc(current.scores?.marketing ?? 0)}" required></label>
            <label><span>Gestão da Franquia <b>/20</b></span><input name="management" type="number" min="0" max="20" step="0.1" value="${esc(current.scores?.management ?? 0)}" required></label>
          </div>
        </section>
        <section class="p5-gates-entry">
          <div><small>REQUISITOS PARA 5 ESTRELAS</small><h3>Confirmações do ciclo</h3><p>Os 2 ciclos consecutivos são verificados automaticamente pelo histórico.</p></div>
          <div class="p5-gates-grid">
            <label><span>Cliente oculto</span><select name="hiddenShopper">${requirementOptions(current.requirements?.hiddenShopper || 'pending', 'Boa avaliação', 'Não atende')}</select></label>
            <label><span>DRE e fluxos</span><select name="reportsOnTime">${requirementOptions(current.requirements?.reportsOnTime || 'pending', 'Todos no prazo', 'Fora do prazo')}</select></label>
            <label><span>Pendências graves</span><select name="noSeriousPending">${requirementOptions(current.requirements?.noSeriousPending || 'pending', 'Sem pendências graves', 'Há pendência grave')}</select></label>
          </div>
        </section>
        <label class="p5-notes-field"><span>Observação <small>opcional</small></span><textarea name="notes" maxlength="2000" rows="2" placeholder="Algo importante sobre este ciclo?">${esc(current.notes || '')}</textarea></label>
        <div class="p5-form-message" data-p5-form-message hidden></div>
        <footer><button type="button" class="secondary" data-p5-close>Cancelar</button>${evaluation ? '' : '<button type="submit" class="secondary" data-p5-save-next>Salvar e lançar próxima</button>'}<button type="submit" data-p5-save>Salvar avaliação</button></footer>
      </form>
    </section>`;
    document.body.appendChild(modal);
    updatePreview(modal.querySelector('[data-p5-form]'));
    requestAnimationFrame(() => modal.querySelector('input[name="unit"]')?.focus());
  };

  const readForm = (form) => {
    const data = new FormData(form);
    const scores = {
      commercial: Math.min(LIMITS.commercial, Math.max(0, number(data.get('commercial')))),
      experience: Math.min(LIMITS.experience, Math.max(0, number(data.get('experience')))),
      marketing: Math.min(LIMITS.marketing, Math.max(0, number(data.get('marketing')))),
      management: Math.min(LIMITS.management, Math.max(0, number(data.get('management')))),
    };
    return {
      ...(state.editingId ? { id: state.editingId } : {}),
      unit: String(data.get('unit') || '').trim(),
      cycle: String(data.get('cycle') || ''),
      evaluatedAt: String(data.get('evaluatedAt') || ''),
      scores,
      requirements: {
        hiddenShopper: String(data.get('hiddenShopper') || 'pending'),
        reportsOnTime: String(data.get('reportsOnTime') || 'pending'),
        noSeriousPending: String(data.get('noSeriousPending') || 'pending'),
      },
      notes: String(data.get('notes') || '').trim(),
    };
  };

  const updatePreview = (form) => {
    if (!form) return;
    const evaluation = readForm(form);
    evaluation.total = totalScore(evaluation.scores);
    evaluation.starsByScore = scoreStars(evaluation.total);
    const total = form.querySelector('[data-p5-live-total]');
    const stars = form.querySelector('[data-p5-live-stars]');
    if (total) total.textContent = evaluation.total.toLocaleString('pt-BR');
    if (stars) stars.textContent = starsText(evaluation.starsByScore);
  };

  const saveForm = async (form, saveNext = false) => {
    const message = form.querySelector('[data-p5-form-message]');
    const buttons = form.querySelectorAll('button[type="submit"]');
    buttons.forEach((button) => { button.disabled = true; });
    if (message) message.hidden = true;
    try {
      const evaluation = readForm(form);
      const payload = await apiJson({ method: 'POST', body: JSON.stringify({ evaluation }) });
      await load(true);
      updateKpis();
      if (saveNext) {
        const cycle = evaluation.cycle;
        const date = evaluation.evaluatedAt;
        openModal();
        const nextForm = document.querySelector('[data-p5-form]');
        if (nextForm) {
          nextForm.elements.cycle.value = cycle;
          nextForm.elements.evaluatedAt.value = date;
          updatePreview(nextForm);
        }
      } else {
        document.querySelector('[data-p5-modal]')?.remove();
        state.editingId = '';
        const evaluationsTab = page()?.querySelector('[data-p5-tab="evaluations"]');
        if (evaluationsTab) evaluationsTab.click();
        requestAnimationFrame(renderActiveTab);
      }
      window.dispatchEvent(new CustomEvent('planet:five-stars-evaluations-updated', { detail: { evaluation: payload.evaluation } }));
    } catch (error) {
      if (message) {
        message.textContent = error instanceof Error ? error.message : String(error);
        message.hidden = false;
      }
      buttons.forEach((button) => { button.disabled = false; });
    }
  };

  const removeEvaluation = async (id) => {
    const evaluation = state.data.find((item) => item.id === id);
    if (!evaluation) return;
    if (!window.confirm(`Excluir a avaliação de ${evaluation.unit} em ${cycleLabel(evaluation.cycle)}?`)) return;
    try {
      await apiJson({ method: 'DELETE', body: JSON.stringify({ id }) });
      await load(true);
      renderActiveTab();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const hydrate = async () => {
    if (!active() || !page()) return;
    decorateHeader();
    await load();
    if (!active()) return;
    updateKpis();
    renderActiveTab();
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(hydrate);
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-p5-new-evaluation]')) {
      event.preventDefault();
      openModal();
      return;
    }
    const edit = event.target.closest?.('[data-p5-edit]');
    if (edit) {
      event.preventDefault();
      const evaluation = state.data.find((item) => item.id === edit.dataset.p5Edit);
      if (evaluation) openModal(evaluation);
      return;
    }
    const remove = event.target.closest?.('[data-p5-delete]');
    if (remove) {
      event.preventDefault();
      removeEvaluation(remove.dataset.p5Delete);
      return;
    }
    if (event.target.closest?.('[data-p5-reload]')) {
      event.preventDefault();
      load(true).then(renderActiveTab);
      return;
    }
    if (event.target.closest?.('[data-p5-close]') || (event.target.matches?.('[data-p5-modal]'))) {
      event.preventDefault();
      document.querySelector('[data-p5-modal]')?.remove();
      state.editingId = '';
      return;
    }
    if (event.target.closest?.('[data-p5-tab]') && active()) requestAnimationFrame(renderActiveTab);
  });

  document.addEventListener('input', (event) => {
    const form = event.target.closest?.('[data-p5-form]');
    if (form && ['commercial', 'experience', 'marketing', 'management'].includes(event.target.name)) updatePreview(form);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-p5-form]');
    if (!form) return;
    event.preventDefault();
    const submitter = event.submitter;
    saveForm(form, Boolean(submitter?.hasAttribute('data-p5-save-next')));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('[data-p5-modal]')) {
      document.querySelector('[data-p5-modal]')?.remove();
      state.editingId = '';
    }
  });

  window.addEventListener('hashchange', schedule);
  window.addEventListener('pmh:view-rendered', (event) => {
    if (event.detail?.view === 'cinco-estrelas' || active()) schedule();
  });
  window.addEventListener('pmh:access-ready', schedule);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
