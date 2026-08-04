(() => {
  'use strict';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const isHome = () => normalize(document.querySelector('[data-title]')?.textContent)
    .includes('painel de marketing');

  const promoteDecisionCockpit = () => {
    if (!isHome()) return;

    const content = document.querySelector('[data-content]');
    if (!content) return;

    const legacyHero = content.querySelector(':scope > .pmh-hero');
    if (legacyHero) legacyHero.remove();

    const cockpit = document.querySelector('[data-decision-cockpit]');
    if (cockpit && cockpit.parentElement === content && content.firstElementChild !== cockpit) {
      content.insertBefore(cockpit, content.firstElementChild);
    }
  };

  const syncTopSearch = () => {
    const search = document.querySelector('[data-search-wrap]');
    if (!search) return;
    const shouldHide = isHome();
    const next = shouldHide ? 'none' : '';
    if (search.style.display !== next) search.style.display = next;
  };

  const compactDemandComposer = () => {
    if (!isHome()) return;

    const target = document.querySelector('[data-internal-demands]');
    const capture = target?.querySelector('.pmh-demand-capture');
    if (!target || !capture) return;

    capture.classList.add('pmh-demand-capture-compact');

    const sectionHead = target.querySelector('.pmh-demand-section-head');
    const footer = capture.querySelector('footer');
    const organizeButton = footer?.querySelector('[data-demand-organize]');
    const manualButton = sectionHead?.querySelector('[data-demand-manual]');

    if (manualButton && footer && !footer.querySelector('[data-demand-manual]')) {
      manualButton.textContent = 'Cadastro manual';
      manualButton.classList.add('pmh-demand-manual-compact');
      footer.insertBefore(manualButton, organizeButton || null);
    }

    if (sectionHead && !sectionHead.hidden) sectionHead.hidden = true;

    const intro = capture.firstElementChild;
    if (intro && intro.dataset.compactCopy !== '1') {
      intro.dataset.compactCopy = '1';
      intro.innerHTML = '<small>NOVA DEMANDA INTERNA</small><h3>Descreva. A IA organiza.</h3><p>Escreva do seu jeito e revise antes de registrar.</p>';
    }

    const textarea = capture.querySelector('[data-demand-input]');
    if (textarea && textarea.dataset.compactPlaceholder !== '1') {
      textarea.dataset.compactPlaceholder = '1';
      textarea.placeholder = 'Ex.: A direção pediu uma campanha para os colaboradores dos shoppings até o fim do mês. A Ágata faz as artes e eu aprovo.';
    }

    if (organizeButton && organizeButton.dataset.compactLabel !== '1') {
      organizeButton.dataset.compactLabel = '1';
      organizeButton.textContent = '✨ Organizar demanda';
    }
  };

  let scheduled = false;
  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      promoteDecisionCockpit();
      syncTopSearch();
      compactDemandComposer();
    });
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener('hashchange', scheduleSync);
  document.addEventListener('click', scheduleSync, true);
  scheduleSync();
})();
