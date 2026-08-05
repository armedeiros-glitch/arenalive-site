(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const ROOT_CLASS = 'aos-mobile';
  const BODY_CLASS = 'aos-mobile-ready';
  const PRIMARY_MOBILE_VIEWS = new Set(['inicio', 'chamados', 'inauguracoes', 'expansao']);
  const OVERFLOW_MOBILE_VIEWS = new Set(['calendario', 'conteudos']);
  const KNOWN_MOBILE_VIEWS = new Set([...PRIMARY_MOBILE_VIEWS, ...OVERFLOW_MOBILE_VIEWS]);
  let frame = 0;
  let observer;

  const mobileViewport = () => {
    const viewport = Number(window.innerWidth) || 9999;
    const screenWidth = Number(window.screen?.width) || viewport;
    return Math.min(viewport, screenWidth) <= MOBILE_MAX;
  };

  const normalizeNavLabels = (nav) => {
    nav.querySelectorAll('button[data-view]').forEach((button) => {
      if (button.querySelector('.aos-mobile-nav-label')) return;

      const textNodes = [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
      const fullLabel = textNodes.map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      textNodes.forEach((node) => node.remove());

      const label = document.createElement('span');
      label.className = 'aos-mobile-nav-label';
      label.textContent = button.dataset.view === 'inauguracoes' ? 'Inaug.' : fullLabel;
      label.dataset.fullLabel = fullLabel;
      button.insertBefore(label, button.querySelector('b'));
      button.setAttribute('aria-label', fullLabel || button.dataset.view || 'Navegação');
    });
  };

  const ensureMoreButton = (nav) => {
    let button = nav.querySelector(':scope > [data-mobile-more]');
    if (button) return button;

    button = document.createElement('button');
    button.type = 'button';
    button.dataset.mobileMore = '1';
    button.className = 'aos-mobile-more-button';
    button.setAttribute('aria-label', 'Abrir mais áreas');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<i aria-hidden="true">•••</i><span class="aos-mobile-nav-label">Mais</span>';
    nav.appendChild(button);
    return button;
  };

  const ensureMoreSheet = (shell) => {
    let sheet = shell.querySelector(':scope > [data-mobile-more-sheet]');
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.className = 'aos-mobile-more-sheet';
    sheet.dataset.mobileMoreSheet = '1';
    sheet.hidden = true;
    sheet.innerHTML = `
      <button type="button" class="aos-mobile-more-backdrop" data-mobile-more-close aria-label="Fechar mais áreas"></button>
      <section class="aos-mobile-more-panel" role="dialog" aria-modal="true" aria-labelledby="aos-mobile-more-title">
        <span class="aos-mobile-more-handle" aria-hidden="true"></span>
        <header>
          <small>NAVEGAÇÃO</small>
          <strong id="aos-mobile-more-title">Mais áreas</strong>
        </header>
        <div class="aos-mobile-more-options">
          <button type="button" data-mobile-more-view="calendario">
            <i aria-hidden="true">▦</i>
            <span><strong>Calendário</strong><small>Campanhas e datas</small></span>
          </button>
          <button type="button" data-mobile-more-view="conteudos">
            <i aria-hidden="true">▤</i>
            <span><strong>Conteúdos</strong><small>Biblioteca da rede</small></span>
          </button>
        </div>
      </section>`;
    shell.appendChild(sheet);
    return sheet;
  };

  const closeMore = () => {
    const sheet = document.querySelector('[data-mobile-more-sheet]');
    const button = document.querySelector('[data-mobile-more]');
    sheet?.classList.remove('open');
    if (sheet) sheet.hidden = true;
    button?.setAttribute('aria-expanded', 'false');
    document.body?.classList.remove('aos-mobile-more-open');
  };

  const openMore = () => {
    if (!mobileViewport()) return;
    const sheet = document.querySelector('[data-mobile-more-sheet]');
    const button = document.querySelector('[data-mobile-more]');
    if (!sheet || !button) return;

    sheet.hidden = false;
    requestAnimationFrame(() => sheet.classList.add('open'));
    button.setAttribute('aria-expanded', 'true');
    document.body.classList.add('aos-mobile-more-open');
    sheet.querySelector('[data-mobile-more-view]')?.focus?.({ preventScroll: true });
  };

  const syncMobileEntries = (nav, active) => {
    const moreButton = ensureMoreButton(nav);

    nav.querySelectorAll('button[data-view]').forEach((button) => {
      const view = String(button.dataset.view || '');
      const financeEntry = button.hasAttribute('data-finance-open');
      const knownView = KNOWN_MOBILE_VIEWS.has(view);
      const primary = PRIMARY_MOBILE_VIEWS.has(view);
      const overflow = OVERFLOW_MOBILE_VIEWS.has(view);
      const hiddenOnMobile = financeEntry || !knownView || overflow;

      button.classList.toggle('aos-mobile-nav-overflow-source', active && overflow);
      button.classList.toggle('aos-mobile-nav-excluded', active && hiddenOnMobile);

      if (active) {
        button.hidden = hiddenOnMobile || !primary;
        if (button.hidden) {
          button.setAttribute('aria-hidden', 'true');
          button.tabIndex = -1;
        } else {
          button.removeAttribute('aria-hidden');
          button.removeAttribute('tabindex');
        }
      } else {
        button.hidden = false;
        button.removeAttribute('aria-hidden');
        button.removeAttribute('tabindex');
      }
    });

    const overflowActive = [...nav.querySelectorAll('button[data-view]')]
      .some((button) => OVERFLOW_MOBILE_VIEWS.has(button.dataset.view) && button.classList.contains('active'));

    moreButton.hidden = !active;
    moreButton.classList.toggle('active', active && overflowActive);
    if (active && overflowActive) moreButton.setAttribute('aria-current', 'page');
    else moreButton.removeAttribute('aria-current');

    if (!active) closeMore();
  };

  const ensureDock = (shell) => {
    let dock = shell.querySelector(':scope > .aos-mobile-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'aos-mobile-dock';
      dock.setAttribute('aria-label', 'Navegação principal');
      shell.appendChild(dock);
    }
    return dock;
  };

  const sync = () => {
    frame = 0;

    const shell = document.querySelector('#pmh-app');
    if (!shell) return false;

    const sidebar = shell.querySelector('.pmh-sidebar');
    const dock = ensureDock(shell);
    const nav = sidebar?.querySelector(':scope > nav') || dock.querySelector(':scope > nav');
    if (!sidebar || !nav) return false;

    normalizeNavLabels(nav);
    ensureMoreSheet(shell);

    const active = mobileViewport();
    document.documentElement.classList.toggle(ROOT_CLASS, active);
    document.body.classList.toggle(BODY_CLASS, active);
    syncMobileEntries(nav, active);

    if (active && nav.parentElement !== dock) {
      dock.appendChild(nav);
    }

    if (!active && nav.parentElement !== sidebar) {
      const footer = sidebar.querySelector(':scope > footer');
      sidebar.insertBefore(nav, footer || null);
    }

    return true;
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  };

  const boot = () => {
    sync();

    observer = new MutationObserver(() => {
      if (document.querySelector('#pmh-app')) schedule();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pmh:view-rendered', schedule);
    window.addEventListener('pmh:navigation-updated', schedule);
    window.addEventListener('hashchange', () => {
      closeMore();
      schedule();
    });

    document.addEventListener('click', (event) => {
      const more = event.target.closest?.('[data-mobile-more]');
      if (more) {
        event.preventDefault();
        more.getAttribute('aria-expanded') === 'true' ? closeMore() : openMore();
        return;
      }

      if (event.target.closest?.('[data-mobile-more-close]')) {
        event.preventDefault();
        closeMore();
        return;
      }

      const option = event.target.closest?.('[data-mobile-more-view]');
      if (!option) return;

      event.preventDefault();
      const view = option.dataset.mobileMoreView;
      const nav = document.querySelector('.aos-mobile-dock nav, .pmh-sidebar nav');
      const source = nav?.querySelector(`button[data-view="${CSS.escape(view)}"]`);
      closeMore();
      source?.click();
      schedule();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMore();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
