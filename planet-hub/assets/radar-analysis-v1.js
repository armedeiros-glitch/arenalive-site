(() => {
  'use strict';

  const ANALYZE_API = '/api/hub/analisar-radar';
  let analyzing = false;

  const radar = () => window.PMHRadarData;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const list = (title, items, renderer) => {
    if (!Array.isArray(items) || !items.length) return '';
    return `<section class="pmh-radar-analysis-block"><h3>${esc(title)}</h3><div>${items.map(renderer).join('')}</div></section>`;
  };

  const analysisText = (analysis) => {
    const lines = [
      'ANÁLISE DO RADAR',
      '',
      analysis.summary || '',
      '',
      analysis.focus ? `FOCO PRINCIPAL\n${analysis.focus.title}\n${analysis.focus.reason}` : '',
      '',
      ...(analysis.nextActions || []).map((item, index) => `${index + 1}. ${item.action}`),
      '',
      ...(analysis.risks || []).map((item) => `Risco: ${item}`),
    ];
    return lines.filter((line, index, array) => line || (index && array[index - 1])).join('\n').trim();
  };

  const renderModal = (analysis) => {
    document.querySelector('[data-radar-analysis-modal]')?.remove();
    const focus = analysis.focus;
    const modal = document.createElement('div');
    modal.className = 'pmh-radar-analysis-modal';
    modal.dataset.radarAnalysisModal = '1';
    modal.innerHTML = `<div class="pmh-radar-analysis-dialog" role="dialog" aria-modal="true" aria-label="Análise do Radar">
      <header><div><small>ANÁLISE OPERACIONAL · ${analysis.mode === 'ai' ? 'WORKERS AI' : 'ANÁLISE LOCAL'}</small><h2>Leitura do Radar</h2><p>${esc(analysis.summary || '')}</p></div><button type="button" data-radar-analysis-close aria-label="Fechar">×</button></header>
      <main>
        ${focus ? `<section class="pmh-radar-focus"><small>FOCO PRINCIPAL AGORA</small><h3>${esc(focus.title)}</h3><p>${esc(focus.reason)}</p><footer><span>${esc(focus.origin || '')}</span>${focus.dueDate ? `<time>${esc(focus.dueDate.split('-').reverse().join('/'))}</time>` : ''}</footer></section>` : ''}
        <div class="pmh-radar-analysis-grid">
          ${list('Próximas ações', analysis.nextActions, (item, index) => `<article><b>${index + 1}</b><span>${esc(item.action)}</span></article>`)}
          ${list('Urgentes', analysis.urgent, (item) => `<article><div><strong>${esc(item.title)}</strong><small>${esc(item.origin)}</small></div><span>${esc(item.reason)}</span></article>`)}
          ${list('Delegar ou cobrar', analysis.delegation, (item) => `<article><div><strong>${esc(item.title)}</strong><small>${esc(item.responsible)}</small></div><span>${esc(item.suggestion)}</span></article>`)}
          ${list('Possíveis bloqueios', analysis.blocked, (item) => `<article><strong>${esc(item.title)}</strong><span>${esc(item.reason)}</span></article>`)}
          ${list('Riscos', analysis.risks, (item) => `<article><span>${esc(item)}</span></article>`)}
        </div>
        ${(analysis.caveats || []).length ? `<aside>${analysis.caveats.map((item) => `<span>ℹ ${esc(item)}</span>`).join('')}</aside>` : ''}
      </main>
      <footer><span>${esc(analysis.itemCount || 0)} demandas analisadas${analysis.sourceErrors?.length ? ` · fontes incompletas: ${esc(analysis.sourceErrors.join(', '))}` : ''}</span><button type="button" data-radar-analysis-copy>Copiar análise</button><button type="button" class="primary" data-radar-analysis-again>Analisar novamente</button></footer>
    </div>`;
    modal.__analysis = analysis;
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('visible'));
  };

  const closeModal = () => {
    const modal = document.querySelector('[data-radar-analysis-modal]');
    if (!modal) return;
    modal.classList.remove('visible');
    setTimeout(() => modal.remove(), 180);
  };

  const analyze = async ({ forceData = false } = {}) => {
    if (analyzing) return;
    const button = document.querySelector('[data-analyze-radar]');
    const service = radar();
    if (!service) return alert('O serviço de dados do Radar não foi carregado.');

    analyzing = true;
    if (button) {
      button.disabled = true;
      button.dataset.originalText ||= button.textContent;
      button.textContent = 'Analisando…';
    }

    try {
      const snapshot = await service.collect({ force: forceData });
      const items = service.toAnalysisItems(snapshot.items);
      if (!items.length) throw new Error('Nenhuma demanda ativa foi encontrada para analisar.');
      const analysis = await fetchJson(ANALYZE_API, {
        method: 'POST',
        body: JSON.stringify({
          today: service.todayIso(),
          items,
          sourceErrors: snapshot.errors,
        }),
      });
      renderModal(analysis);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Não foi possível analisar o Radar.');
    } finally {
      analyzing = false;
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.originalText || '✨ Analisar Radar';
      }
    }
  };

  const ensureButton = () => {
    const head = document.querySelector('[data-active-workstream] .pmh-active-head');
    if (!head || head.querySelector('[data-analyze-radar]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pmh-analyze-radar-button';
    button.dataset.analyzeRadar = '1';
    button.textContent = '✨ Analisar Radar';
    const count = head.querySelector(':scope > b');
    if (count) count.insertAdjacentElement('beforebegin', button);
    else head.appendChild(button);
  };

  document.addEventListener('click', async (event) => {
    if (event.target.closest('[data-analyze-radar]')) return analyze();
    if (event.target.closest('[data-radar-analysis-close]')) return closeModal();
    if (event.target.matches('[data-radar-analysis-modal]')) return closeModal();
    if (event.target.closest('[data-radar-analysis-again]')) {
      closeModal();
      setTimeout(() => analyze({ forceData: true }), 220);
      return;
    }
    const copy = event.target.closest('[data-radar-analysis-copy]');
    if (copy) {
      const modal = copy.closest('[data-radar-analysis-modal]');
      const text = analysisText(modal?.__analysis || {});
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copiado ✓';
        setTimeout(() => { copy.textContent = 'Copiar análise'; }, 1500);
      } catch {
        alert('Não foi possível copiar a análise.');
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  const observer = new MutationObserver(ensureButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  ensureButton();
})();
