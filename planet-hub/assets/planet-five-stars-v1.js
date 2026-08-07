(() => {
  'use strict';

  const ROUTES = new Set(['5-estrelas', 'cinco-estrelas', '5estrelas']);
  const TABS = new Set(['overview', 'units', 'evaluations', 'criteria', 'actions']);
  let activeTab = 'overview';
  let frame = 0;

  const hash = () => String(location.hash || '').replace(/^#/, '').toLowerCase();
  const active = () => ROUTES.has(hash());
  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');

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

  const overview = () => `
    <section class="p5-overview-grid">
      <article class="p5-panel p5-panel-main">
        <header><div><small>MODELO OPERACIONAL</small><h3>Da avaliação para a melhoria</h3></div><span class="p5-pill">Sem notas fictícias</span></header>
        <div class="p5-flow">
          <div><b>1</b><span><strong>Avaliar</strong><small>Registrar a avaliação real da unidade.</small></span></div><i>→</i>
          <div><b>2</b><span><strong>Diagnosticar</strong><small>Mostrar o que impede a unidade de chegar a 5 estrelas.</small></span></div><i>→</i>
          <div><b>3</b><span><strong>Agir</strong><small>Levar a correção para a gaveta responsável.</small></span></div>
        </div>
        <div class="p5-empty-note"><strong>Base oficial ainda não conectada.</strong><span>A estrutura está pronta, mas nenhuma nota, critério ou avaliação será criada por estimativa.</span></div>
      </article>
      <aside class="p5-panel p5-connections">
        <header><div><small>CONEXÕES</small><h3>Quem executa a correção</h3></div></header>
        <div class="p5-connection-list">
          <span><i>✦</i><b>Marketing</b><em>padrão visual e materiais</em></span>
          <span><i>▦</i><b>Campanhas</b><em>execução de campanha</em></span>
          <span><i>▥</i><b>Chamados</b><em>suporte e pendências da unidade</em></span>
        </div>
        <p>O 5 Estrelas diagnostica. As outras gavetas executam.</p>
      </aside>
    </section>`;

  const panel = (tab) => {
    if (tab === 'units') return emptyPanel('UNIDADES', 'Nenhuma unidade avaliada conectada', 'Aqui entram nota atual, tendência, última avaliação, pendências e próximo acompanhamento por unidade.', 'Quando houver dados reais, abrir uma unidade mostrará o que falta para virar 5 estrelas.');
    if (tab === 'evaluations') return emptyPanel('AVALIAÇÕES', 'Histórico de avaliações ainda sem fonte', 'Esta visão será a linha do tempo das avaliações para acompanhar evolução sem apagar o passado.', 'Nenhum histórico será fabricado para preencher a tela.');
    if (tab === 'criteria') return emptyPanel('CRITÉRIOS', 'Critérios oficiais ainda não vinculados', 'Pesos, regras e pilares precisam vir do material oficial do Planet 5 Estrelas.', 'O André OS não vai deduzir critérios nem pesos por conta própria.');
    if (tab === 'actions') return emptyPanel('PLANOS DE AÇÃO', 'Planos nascem de avaliações reais', 'Quando uma avaliação apontar uma lacuna, esta área transforma o diagnóstico em ações concretas e acompanha a resolução.', 'Marketing, Campanhas e Chamados continuam sendo as gavetas de execução.');
    return overview();
  };

  const markup = () => `
    <section class="p5-page" data-p5-page aria-label="Planet 5 Estrelas">
      <header class="p5-intro">
        <div><small>PLANET 5 ESTRELAS</small><h2>Saúde e evolução da rede</h2><p>Avaliar, entender o que falta e transformar diagnóstico em ação.</p></div>
        <span class="p5-source-status"><i></i>Base de avaliações pendente</span>
      </header>
      <section class="p5-kpis" aria-label="Resumo do programa">
        <article><small>MÉDIA DA REDE</small><strong>—</strong><span>aguardando avaliações</span></article>
        <article><small>UNIDADES AVALIADAS</small><strong>—</strong><span>fonte ainda não conectada</span></article>
        <article><small>EM ATENÇÃO</small><strong>—</strong><span>sem classificação oficial</span></article>
        <article><small>PLANOS ATRASADOS</small><strong>—</strong><span>sem planos gerados</span></article>
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
