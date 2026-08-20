(() => {
  'use strict';

  const ROUTES = new Set(['5-estrelas', 'cinco-estrelas', '5estrelas']);
  const TABS = new Set(['overview', 'units', 'evaluations', 'criteria', 'actions']);
  const PROGRAM = Object.freeze({
    sourceLabel: 'Regulamento v4 em validação',
    totalPoints: 100,
    pillars: [
      {
        name: 'Resultado Comercial',
        points: 35,
        criteria: ['Crescimento de faturamento', 'Ticket médio', 'Evolução da própria unidade', 'Taxa de conversão'],
      },
      {
        name: 'Experiência do Cliente',
        points: 25,
        criteria: ['Cliente oculto', 'Atendimento', 'Apresentação dos produtos', 'Limpeza percebida', 'Experiência geral'],
      },
      {
        name: 'Marketing e Participação',
        points: 20,
        criteria: ['Adesão às campanhas', 'Uso correto dos materiais', 'Publicações da unidade', 'Participação em reuniões e treinamentos'],
      },
      {
        name: 'Gestão da Franquia',
        points: 20,
        criteria: ['Envio mensal da DRE', 'Contagem de fluxo', 'Pontualidade das informações', 'Resposta a chamados', 'Cumprimento das obrigações da rede'],
      },
    ],
    classifications: [
      { stars: 1, min: 0, max: 39, label: 'Unidade em desenvolvimento' },
      { stars: 2, min: 40, max: 59, label: 'Unidade em evolução' },
      { stars: 3, min: 60, max: 74, label: 'Unidade certificada Planet' },
      { stars: 4, min: 75, max: 89, label: 'Unidade destaque Planet' },
      { stars: 5, min: 90, max: 100, label: 'Excelência Planet' },
    ],
    fiveStarRules: [
      'Nota geral a partir de 90 pontos',
      'Boa avaliação no cliente oculto',
      'Todas as DREs e fluxos enviados no prazo',
      'Sem pendências graves com a franqueadora',
      'Manutenção da pontuação por 2 ciclos consecutivos',
    ],
    distinctions: [
      { years: 1, name: 'Pin Bronze', label: 'Consistência' },
      { years: 3, name: 'Pin Prata', label: 'Referência' },
      { years: 5, name: 'Pin Ouro', label: 'Excelência histórica' },
      { years: 7, name: 'Pin Diamante', label: 'Legado Planet' },
    ],
    cycle: [
      { step: '01', name: 'Acompanhamento mensal', detail: 'Recebimento de DRE, fluxo e indicadores da unidade.' },
      { step: '02', name: 'Consolidação semestral', detail: 'Fechamento do ciclo e cálculo da pontuação.' },
      { step: '03', name: 'Validação dos resultados', detail: 'Análise final, cliente oculto e confirmação da classificação.' },
      { step: '04', name: 'Reconhecimento anual', detail: 'Divulgação dos destaques e premiações no encontro da rede.' },
    ],
    nextSteps: ['Validar o regulamento', 'Definir responsáveis', 'Executar fase piloto', 'Lançamento oficial'],
  });

  let activeTab = 'overview';
  let frame = 0;

  const hash = () => String(location.hash || '').replace(/^#/, '').toLowerCase();
  const active = () => ROUTES.has(hash());
  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');
  const stars = (count) => '★'.repeat(count) + '☆'.repeat(5 - count);

  const ensureOverviewEntry = () => {
    if (hash() !== 'planet') return;
    const drawers = document.querySelector('.aos-planet-drawers');
    if (!drawers || drawers.querySelector('[data-p5-overview-entry]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'aos-planet-drawer-card';
    button.dataset.p5OverviewEntry = 'true';
    button.dataset.shellHash = '#5-estrelas';
    button.innerHTML = '<i>☆</i><span><small>REDE</small><strong>Planet 5 Estrelas</strong><em>Avaliações e evolução das unidades</em></span>';
    const central = drawers.querySelector('[data-home-destination="conteudos"]');
    if (central) drawers.insertBefore(button, central);
    else drawers.appendChild(button);
  };

  const emptyPanel = (eyebrow, heading, body, note) => `
    <section class="p5-panel p5-empty-panel">
      <div class="p5-empty-icon">☆</div>
      <small>${eyebrow}</small>
      <h3>${heading}</h3>
      <p>${body}</p>
      <span>${note}</span>
    </section>`;

  const cycleMarkup = () => PROGRAM.cycle.map((item, index) => `
    <div class="p5-cycle-step">
      <b>${item.step}</b>
      <span><strong>${item.name}</strong><small>${item.detail}</small></span>
      ${index < PROGRAM.cycle.length - 1 ? '<i aria-hidden="true">→</i>' : ''}
    </div>`).join('');

  const overview = () => `
    <section class="p5-overview-stack">
      <section class="p5-overview-grid">
        <article class="p5-panel p5-panel-main">
          <header>
            <div><small>COMO FUNCIONA O CICLO</small><h3>Acompanhar, consolidar, validar e reconhecer</h3></div>
            <span class="p5-pill">Base v4</span>
          </header>
          <div class="p5-cycle">${cycleMarkup()}</div>
        </article>
        <aside class="p5-panel p5-five-star-rules">
          <header><div><small>5 ESTRELAS</small><h3>O topo exige mais que 90 pontos</h3></div></header>
          <div class="p5-rule-list">${PROGRAM.fiveStarRules.map((rule) => `<span><i>✓</i>${rule}</span>`).join('')}</div>
          <p>O material define a categoria máxima como aspiracional, difícil de conquistar e difícil de manter.</p>
        </aside>
      </section>

      <section class="p5-panel p5-classification-panel">
        <header><div><small>REGRA DE CLASSIFICAÇÃO</small><h3>100 pontos distribuídos em 5 faixas</h3></div><span class="p5-pill">4 pilares</span></header>
        <div class="p5-classification-strip">
          ${PROGRAM.classifications.map((item) => `<article><span class="p5-stars">${stars(item.stars)}</span><strong>${item.min}–${item.max}</strong><small>pontos</small><em>${item.label}</em></article>`).join('')}
        </div>
        <p class="p5-classification-note">Classificações de 1 e 2 estrelas têm foco em acompanhamento e evolução interna.</p>
      </section>

      <section class="p5-overview-grid p5-secondary-grid">
        <article class="p5-panel">
          <header><div><small>PERMANÊNCIA NO TOPO</small><h3>Distinções de excelência</h3></div></header>
          <div class="p5-distinction-grid">${PROGRAM.distinctions.map((item) => `<span><b>${item.years}</b><strong>${item.name}</strong><em>${item.label}</em><small>${item.years === 1 ? 'ano' : 'anos'} contínuos</small></span>`).join('')}</div>
          <p class="p5-footnote">A contagem começa após a primeira certificação 5 estrelas, exige permanência contínua e reinicia se a unidade deixar o topo.</p>
        </article>
        <aside class="p5-panel p5-validation-panel">
          <header><div><small>STATUS DO PROGRAMA</small><h3>Ainda em validação</h3></div></header>
          <ol>${PROGRAM.nextSteps.map((step) => `<li>${step}</li>`).join('')}</ol>
          <p>Por isso o André OS já usa as regras da v4 como referência, mas não cria notas ou avaliações históricas sem dados reais.</p>
        </aside>
      </section>
    </section>`;

  const criteriaPanel = () => `
    <section class="p5-criteria-stack">
      <section class="p5-pillar-grid">
        ${PROGRAM.pillars.map((pillar) => `<article class="p5-panel p5-pillar-card">
          <header><div><small>PILAR</small><h3>${pillar.name}</h3></div><strong class="p5-point-badge">${pillar.points}<small>pts</small></strong></header>
          <ul>${pillar.criteria.map((criterion) => `<li>${criterion}</li>`).join('')}</ul>
        </article>`).join('')}
      </section>
      <div class="p5-regulation-note"><strong>Total: ${PROGRAM.totalPoints} pontos.</strong><span>O material v4 define o peso de cada pilar, mas não informa peso individual dos subcritérios. O sistema não vai inventar essa divisão.</span></div>
      <section class="p5-panel p5-classification-panel">
        <header><div><small>FAIXAS</small><h3>Classificação por estrelas</h3></div></header>
        <div class="p5-classification-strip">
          ${PROGRAM.classifications.map((item) => `<article><span class="p5-stars">${stars(item.stars)}</span><strong>${item.min}–${item.max}</strong><small>pontos</small><em>${item.label}</em></article>`).join('')}
        </div>
      </section>
      <section class="p5-panel p5-requirements-panel">
        <header><div><small>REGRA ESPECIAL</small><h3>Para alcançar 5 estrelas</h3></div></header>
        <div class="p5-requirement-grid">${PROGRAM.fiveStarRules.map((rule, index) => `<span><b>${index + 1}</b><em>${rule}</em></span>`).join('')}</div>
      </section>
    </section>`;

  const evaluationsPanel = () => `
    <section class="p5-evaluation-stack">
      ${emptyPanel('AVALIAÇÕES', 'Ainda não há avaliações de unidades conectadas', 'A v4 já define o ciclo: acompanhamento mensal, consolidação semestral, validação dos resultados e reconhecimento anual.', 'Quando a base real entrar, esta aba guarda cada ciclo sem apagar o histórico.')}
      <section class="p5-panel p5-evaluation-source">
        <header><div><small>ENTRADAS DO CICLO</small><h3>O que a avaliação precisa receber</h3></div></header>
        <div class="p5-source-grid"><span>DRE</span><span>Fluxo</span><span>Indicadores</span><span>Cliente oculto</span><span>Participação</span><span>Chamados e obrigações</span></div>
      </section>
    </section>`;

  const panel = (tab) => {
    if (tab === 'units') return emptyPanel('UNIDADES', 'Nenhuma unidade avaliada conectada', 'Aqui entram nota atual, estrelas, tendência, última avaliação, requisitos de 5 estrelas e próximo acompanhamento por unidade.', 'Abrir uma unidade mostrará o que falta para subir de classificação quando os dados reais estiverem disponíveis.');
    if (tab === 'evaluations') return evaluationsPanel();
    if (tab === 'criteria') return criteriaPanel();
    if (tab === 'actions') return emptyPanel('PLANOS DE AÇÃO', 'Planos nascem das lacunas reais da avaliação', 'Uma nota baixa ou requisito não atendido deve virar ação concreta e ser encaminhado para a gaveta responsável.', 'Marketing, Campanhas e Chamados continuam sendo as áreas de execução.');
    return overview();
  };

  const markup = () => `
    <section class="p5-page" data-p5-page aria-label="Planet 5 Estrelas">
      <header class="p5-intro">
        <div><small>PLANET 5 ESTRELAS</small><h2>Saúde e evolução da rede</h2><p>Reconhecer resultados, estimular evolução e sustentar um padrão de excelência.</p></div>
        <span class="p5-source-status validation"><i></i>${PROGRAM.sourceLabel}</span>
      </header>
      <section class="p5-kpis" aria-label="Resumo do programa">
        <article><small>MÉDIA DA REDE</small><strong>—</strong><span>aguardando avaliações reais</span></article>
        <article><small>UNIDADES AVALIADAS</small><strong>—</strong><span>base operacional ainda não conectada</span></article>
        <article><small>5 ESTRELAS</small><strong>—</strong><span>sem ciclo consolidado</span></article>
        <article><small>EM EVOLUÇÃO</small><strong>—</strong><span>classificações 1 e 2 estrelas</span></article>
      </section>
      <nav class="p5-tabs" aria-label="Seções do Planet 5 Estrelas">
        <button type="button" data-p5-tab="overview">Visão geral</button>
        <button type="button" data-p5-tab="units">Unidades</button>
        <button type="button" data-p5-tab="evaluations">Avaliações</button>
        <button type="button" data-p5-tab="criteria">Critérios</button>
        <button type="button" data-p5-tab="actions">Planos de ação</button>
      </nav>
      <div class="p5-tab-content" data-p5-content>${panel(activeTab)}</div>
    </section>`;

  const syncTabs = (root) => root.querySelectorAll('[data-p5-tab]').forEach((button) => {
    const selected = button.dataset.p5Tab === activeTab;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-current', selected ? 'page' : 'false');
  });

  const setTab = (tab) => {
    if (!TABS.has(tab)) return;
    activeTab = tab;
    const root = document.querySelector('[data-p5-page]');
    const target = root?.querySelector('[data-p5-content]');
    if (!root || !target) return;
    target.innerHTML = panel(tab);
    syncTabs(root);
  };

  const render = () => {
    if (!active()) return;
    const target = content();
    if (!target) return;
    if (title()) title().textContent = 'Planet 5 Estrelas';
    if (target.dataset.planetFiveStars === 'v1' && target.querySelector('[data-p5-page]')) return syncTabs(target);

    activeTab = 'overview';
    target.dataset.planetFiveStars = 'v1';
    target.innerHTML = markup();
    syncTabs(target);
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('pmh:view-rendered', {
      detail: { view: 'cinco-estrelas', page: 'cinco-estrelas', content: target, segmented: true, viewId: 'planet-five-stars:v1' },
    })));
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      ensureOverviewEntry();
      render();
    });
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-p5-tab]');
    if (button && active()) setTab(String(button.dataset.p5Tab || 'overview'));
  });
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pmh:view-rendered', (event) => {
    if (event.detail?.view !== 'cinco-estrelas') schedule();
  });
  window.addEventListener('andre-os:home-page-rendered', schedule);
  window.addEventListener('pmh:access-ready', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
