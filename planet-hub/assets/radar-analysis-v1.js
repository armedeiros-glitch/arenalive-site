(() => {
  'use strict';

  const ANALYZE_API = '/api/hub/analisar-radar';
  const SOURCES = [
    ['SULTS', '/api/sults/chamados?start=0&limit=100'],
    ['Inaugurações', '/api/hub/inauguracoes'],
    ['Demandas internas', '/api/hub/demandas-internas'],
    ['Conteúdos', '/api/hub/conteudos'],
    ['Campanhas', '/api/hub/campanhas'],
  ];

  let analyzing = false;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
    ? String(value).slice(0, 10)
    : '';

  const dayDiff = (value) => {
    const date = cleanDate(value);
    if (!date) return null;
    const due = new Date(`${date}T12:00:00`);
    const today = new Date(`${todayIso()}T12:00:00`);
    return Math.round((due - today) / 86400000);
  };

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

  const ticketDue = (item) => item.stipulatedResolutionAt || item.plannedResolutionAt || '';
  const ticketFinished = (item) => Boolean(
    item.concludedAt || item.resolvedAt || [2, 3].includes(Number(item.situation?.id || item.situationId)),
  );

  const fromTickets = (items) => items
    .filter((item) => !ticketFinished(item))
    .map((item) => ({
      id: `ticket-${item.sultsTicketId || item.id}`,
      origin: 'SULTS',
      title: item.title || 'Demanda sem título',
      context: item.unit || item.department || 'Chamado do Marketing',
      responsible: item.responsible || 'Não definido',
      status: item.situation?.name || 'Aberta',
      dueDate: cleanDate(ticketDue(item)),
      priority: ticketDue(item) && (dayDiff(ticketDue(item)) ?? 1) < 0 ? 0 : 2,
      updatedAt: item.lastChangeAt || item.openedAt || '',
    }));

  const fromInaugurations = (items) => items
    .filter((item) => {
      const checklist = Array.isArray(item.checklist) ? item.checklist : [];
      return !checklist.length || checklist.some((step) => !step.done);
    })
    .map((item) => {
      const checklist = Array.isArray(item.checklist) ? item.checklist : [];
      const done = checklist.filter((step) => step.done).length;
      return {
        id: `inauguration-${item.id}`,
        origin: 'Inauguração',
        title: item.unit || 'Inauguração sem unidade',
        context: item.location || 'Implantação acompanhada',
        responsible: item.responsible || 'Não definido',
        status: checklist.length ? `${done}/${checklist.length} etapas` : 'Em acompanhamento',
        dueDate: cleanDate(item.openingDate),
        priority: item.openingDate && (dayDiff(item.openingDate) ?? 99) <= 7 ? 1 : 3,
        updatedAt: item.updatedAt || '',
      };
    });

  const demandOrigin = (origin) => ({
    direction: 'Direção',
    meeting: 'Reunião',
    whatsapp: 'WhatsApp',
    internal: 'Operação interna',
    other: 'Outra origem',
  }[origin] || 'Demanda interna');

  const fromDemands = (items) => items
    .filter((item) => !['completed', 'cancelled'].includes(item.status))
    .map((item) => ({
      id: `demand-${item.id}`,
      origin: demandOrigin(item.origin),
      title: item.title || 'Demanda sem título',
      context: item.category || 'Demanda interna',
      responsible: item.responsible || 'Não definido',
      status: ({ new: 'Nova', in_progress: 'Em andamento', waiting: 'Aguardando' }[item.status] || 'Ativa'),
      dueDate: cleanDate(item.dueDate),
      priority: ({ urgent: 0, high: 1, normal: 2, low: 3 }[item.priority] ?? 2),
      updatedAt: item.updatedAt || '',
    }));

  const fromContents = (items) => items
    .filter((item) => ['planejamento', 'producao', 'aprovacao'].includes(item.status))
    .map((item) => ({
      id: `content-${item.id}`,
      origin: /social|reels|instagram|facebook/i.test([item.category, item.format, ...(item.tags || [])].join(' '))
        ? 'Social media'
        : 'Conteúdo',
      title: item.title || 'Conteúdo sem título',
      context: [item.category, item.campaign, item.unit].filter(Boolean).join(' · ') || 'Biblioteca de conteúdos',
      responsible: item.responsible || 'Não definido',
      status: ({ planejamento: 'Planejamento', producao: 'Em produção', aprovacao: 'Em aprovação' }[item.status] || 'Ativo'),
      dueDate: cleanDate(item.dueDate),
      priority: item.status === 'aprovacao' ? 1 : item.status === 'producao' ? 2 : 3,
      updatedAt: item.updatedAt || '',
    }));

  const campaignName = (id) => {
    const slug = String(id || '').split('__')[1] || 'campanha';
    return slug.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const campaignStart = (id) => String(id || '').split('__')[0] || '';

  const fromCampaigns = (items) => items
    .filter((item) => ['planejamento', 'producao', 'aprovacao', 'ativa'].includes(item.status))
    .map((item) => ({
      id: `campaign-${item.id}`,
      origin: 'Campanha',
      title: campaignName(item.id),
      context: item.nextMilestone || 'Campanha do calendário',
      responsible: item.responsible || 'Não definido',
      status: ({ planejamento: 'Planejamento', producao: 'Em produção', aprovacao: 'Em aprovação', ativa: 'Ativa' }[item.status] || 'Ativa'),
      dueDate: cleanDate(item.milestoneDate || campaignStart(item.id)),
      priority: item.status === 'ativa' ? 0 : item.status === 'aprovacao' ? 1 : 2,
      updatedAt: item.updatedAt || '',
    }));

  const collectRadar = async () => {
    const results = await Promise.allSettled(SOURCES.map(([, url]) => fetchJson(url)));
    const values = results.map((result) => result.status === 'fulfilled' && Array.isArray(result.value.data)
      ? result.value.data
      : []);
    const errors = results
      .map((result, index) => result.status === 'rejected' ? SOURCES[index][0] : '')
      .filter(Boolean);

    return {
      errors,
      items: [
        ...fromTickets(values[0]),
        ...fromInaugurations(values[1]),
        ...fromDemands(values[2]),
        ...fromContents(values[3]),
        ...fromCampaigns(values[4]),
      ],
    };
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

  const analyze = async () => {
    if (analyzing) return;
    const button = document.querySelector('[data-analyze-radar]');
    analyzing = true;
    if (button) {
      button.disabled = true;
      button.dataset.originalText ||= button.textContent;
      button.textContent = 'Analisando…';
    }

    try {
      const radar = await collectRadar();
      if (!radar.items.length) throw new Error('Nenhuma demanda ativa foi encontrada para analisar.');
      const analysis = await fetchJson(ANALYZE_API, {
        method: 'POST',
        body: JSON.stringify({
          today: todayIso(),
          items: radar.items,
          sourceErrors: radar.errors,
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
      setTimeout(analyze, 220);
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
