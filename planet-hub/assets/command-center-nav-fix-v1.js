(() => {
  const shell = document.getElementById('pmh-command-center');
  const root = document.getElementById('root');
  if (!shell) return;

  const content = shell.querySelector('[data-pmh-content]');
  const title = shell.querySelector('[data-pmh-title]');
  const search = shell.querySelector('.pmh-cc-search');

  const labels = {
    inauguracoes: 'Inaugurações',
    calendario: 'Calendário de campanhas',
    conteudos: 'Conteúdos',
  };

  const patterns = {
    inauguracoes: [/inaugura/, /implanta/],
    calendario: [/campanha/, /calend/],
    conteudos: [/conte[uú]do/, /biblioteca/, /materiais/],
  };

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const fullMode = new URLSearchParams(window.location.search).get('full') === '1';
  if (fullMode) {
    document.body.classList.remove('pmh-command-mode');
    shell.hidden = true;
    root?.removeAttribute('aria-hidden');
    return;
  }

  const normalizeKey = (key) => key === 'campanhas' ? 'calendario' : key;

  const setActive = (key) => {
    const normalizedKey = normalizeKey(key);
    shell.querySelectorAll('.pmh-cc-sidebar nav button').forEach((button) => {
      button.classList.toggle('is-active', normalizeKey(button.dataset.pmhOpen) === normalizedKey);
    });
  };

  const findTarget = (doc, key) => {
    const normalizedKey = normalizeKey(key);
    const candidates = [...doc.querySelectorAll('#root button, #root a')];
    return candidates.find((node) => {
      const text = normalize(node.textContent);
      return (patterns[normalizedKey] || []).some((pattern) => pattern.test(text));
    });
  };

  const navigateFrame = (frame, key) => {
    let attempts = 0;
    const normalizedKey = normalizeKey(key);
    const tryNavigate = () => {
      attempts += 1;
      try {
        const doc = frame.contentDocument;
        const target = doc && findTarget(doc, normalizedKey);
        if (target) {
          target.click();
          return;
        }
      } catch (error) {
        console.warn('Planet Hub: não foi possível acessar a página incorporada', error);
      }
      if (attempts < 30) window.setTimeout(tryNavigate, 120);
      else {
        try {
          frame.contentWindow.location.hash = normalizedKey === 'calendario' ? '#campanhas' : `#${normalizedKey}`;
        } catch (_) {}
      }
    };
    tryNavigate();
  };

  const openEmbedded = (key, updateUrl = true) => {
    const normalizedKey = normalizeKey(key);
    if (!labels[normalizedKey]) return;

    document.body.classList.add('pmh-command-mode');
    shell.hidden = false;
    root?.setAttribute('aria-hidden', 'true');
    setActive(normalizedKey);
    if (search) search.hidden = true;
    if (title) title.textContent = labels[normalizedKey];
    content.classList.add('pmh-cc-embedded');
    content.innerHTML = '<div class="pmh-cc-embed-loading">Abrindo área do Marketing Hub…</div>';

    const frame = document.createElement('iframe');
    frame.className = 'pmh-cc-embedded-frame';
    frame.title = labels[normalizedKey];
    frame.src = normalizedKey === 'calendario'
      ? '/planet-hub/embed.html#campanhas'
      : `/planet-hub/embed.html#${normalizedKey}`;
    frame.addEventListener('load', () => navigateFrame(frame, normalizedKey));
    content.replaceChildren(frame);

    if (updateUrl) history.replaceState(null, '', `#nucleo/${normalizedKey}`);
  };

  shell.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-pmh-open]');
    if (!openButton) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const key = normalizeKey(openButton.dataset.pmhOpen);
    if (key === 'hub') {
      window.location.href = '/planet-hub/?full=1';
      return;
    }

    openEmbedded(key);
  }, true);

  shell.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-pmh-view]');
    if (!viewButton) return;
    content.classList.remove('pmh-cc-embedded');
    if (viewButton.dataset.pmhView === 'inicio') history.replaceState(null, '', '#nucleo/inicio');
    if (viewButton.dataset.pmhView === 'chamados') history.replaceState(null, '', '#nucleo/chamados');
  }, true);

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== 'pmh-native-ready') return;
    const frame = content.querySelector('.pmh-cc-embedded-frame');
    const route = normalizeKey(window.location.hash.match(/^#nucleo\/(.+)$/)?.[1]);
    if (frame && labels[route]) navigateFrame(frame, route);
  });

  let initialRoute = normalizeKey(window.location.hash.match(/^#nucleo\/(.+)$/)?.[1]);
  if (initialRoute === 'campanhas') initialRoute = 'calendario';
  if (labels[initialRoute]) window.setTimeout(() => openEmbedded(initialRoute, false), 0);
})();
