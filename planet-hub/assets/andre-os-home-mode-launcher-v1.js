(() => {
  'use strict';

  const HOME_HASHES = new Set(['', 'inicio', 'hoje']);
  const MODE_HASHES = new Set(['laboratorio', 'pessoal']);
  let frame = 0;

  const hash = () => String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();
  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');

  const launcherMarkup = () => `
    <section class="aos-mode-launcher" data-aos-mode-launcher aria-label="Escolher ambiente do André OS">
      <header>
        <small>ANDRÉ OS</small>
        <h2>O que você quer fazer?</h2>
        <p>Escolha o ambiente. Cada coisa fica na sua gaveta.</p>
      </header>
      <div class="aos-mode-launcher-grid">
        <button type="button" class="aos-mode-card work" data-aos-mode-destination="planet">
          <i aria-hidden="true">▦</i>
          <span><small>TRABALHO</small><strong>Planet Chocolate</strong><em>Marketing, campanhas, inaugurações, chamados e expansão.</em></span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" class="aos-mode-card lab" data-aos-mode-destination="laboratorio">
          <i aria-hidden="true">⌁</i>
          <span><small>LABORATÓRIO</small><strong>Explorar ideias</strong><em>Projetos, hipóteses, testes e coisas que ainda estão tomando forma.</em></span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" class="aos-mode-card personal" data-aos-mode-destination="pessoal">
          <i aria-hidden="true">◉</i>
          <span><small>VIDA PESSOAL</small><strong>Pessoal</strong><em>Rotina, compromissos e organização fora do trabalho.</em></span>
          <b aria-hidden="true">→</b>
        </button>
      </div>
    </section>`;

  const mountLauncher = () => {
    if (!HOME_HASHES.has(hash())) return;
    const home = document.querySelector('[data-content][data-home-page="hoje"] .aos-home-page-today');
    if (!home || home.querySelector('[data-aos-mode-launcher]')) return;
    home.insertAdjacentHTML('beforeend', launcherMarkup());
  };

  const modeMarkup = (mode) => {
    const lab = mode === 'laboratorio';
    return `<section class="aos-mode-page" data-aos-mode-page="${mode}">
      <button type="button" class="aos-mode-back" data-aos-mode-destination="inicio">← Início</button>
      <header class="aos-mode-page-hero">
        <small>${lab ? 'LABORATÓRIO' : 'VIDA PESSOAL'}</small>
        <h2>${lab ? 'Espaço para pensar, testar e construir' : 'Sua vida fora do trabalho'}</h2>
        <p>${lab ? 'Aqui entram ideias, projetos experimentais e hipóteses sem misturar com a operação da Planet.' : 'Aqui vão entrar rotina, agenda, compromissos e organização pessoal, sem misturar com o trabalho.'}</p>
      </header>
      <section class="aos-mode-page-empty">
        <i aria-hidden="true">${lab ? '⌁' : '◉'}</i>
        <strong>${lab ? 'Laboratório aberto' : 'Pessoal aberto'}</strong>
        <span>${lab ? 'A gaveta está criada. Agora podemos definir o que merece morar aqui.' : 'A gaveta está criada. Vamos alimentar só com o que realmente for útil para sua vida pessoal.'}</span>
      </section>
    </section>`;
  };

  const mountModePage = () => {
    const current = hash();
    if (!MODE_HASHES.has(current)) return false;
    const target = content();
    if (!target) return false;
    if (target.querySelector(`[data-aos-mode-page="${current}"]`)) return true;

    target.removeAttribute('data-home-page');
    target.innerHTML = modeMarkup(current);
    const heading = title();
    if (heading) heading.textContent = current === 'laboratorio' ? 'Laboratório' : 'Pessoal';
    window.dispatchEvent(new CustomEvent('andre-os:mode-page-rendered', { detail: { mode: current, content: target } }));
    return true;
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!mountModePage()) mountLauncher();
    }));
  };

  document.addEventListener('click', (event) => {
    const destination = event.target.closest?.('[data-aos-mode-destination]');
    if (!destination) return;
    const target = destination.dataset.aosModeDestination;
    if (target === 'planet') location.hash = '#planet';
    else if (target === 'laboratorio') location.hash = '#laboratorio';
    else if (target === 'pessoal') location.hash = '#pessoal';
    else location.hash = '#inicio';
  });

  window.addEventListener('hashchange', schedule);
  window.addEventListener('andre-os:home-page-rendered', schedule);
  window.addEventListener('pmh:view-rendered', schedule);
  window.addEventListener('pmh:access-ready', schedule);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
