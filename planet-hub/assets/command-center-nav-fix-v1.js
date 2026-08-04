(() => {
  const shell = document.getElementById('pmh-command-center');
  const root = document.getElementById('root');
  if (!shell) return;

  const content = shell.querySelector('[data-pmh-content]');
  const title = shell.querySelector('[data-pmh-title]');
  const search = shell.querySelector('.pmh-cc-search');
  const IMPLANTATIONS_API = '/api/sults/implantacoes?start=0&limit=100';
  const LOCAL_IMPLANTATIONS_KEY = 'planet-hub-implantations-v1';

  const labels = {
    inauguracoes: 'Inaugurações',
    calendario: 'Calendário de campanhas',
    conteudos: 'Conteúdos',
  };

  const patterns = {
    calendario: [/campanha/, /calend/],
    conteudos: [/conte[uú]do/, /biblioteca/, /materiais/],
  };

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character]));

  const formatDate = (value) => {
    if (!value) return 'Sem data prevista';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sem data prevista';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  };

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
      const openKey = normalizeKey(button.dataset.pmhOpen);
      button.classList.toggle('is-active', openKey === normalizedKey);
    });
  };

  const prepareNativeArea = (key) => {
    document.body.classList.add('pmh-command-mode');
    shell.hidden = false;
    root?.setAttribute('aria-hidden', 'true');
    setActive(key);
    if (search) search.hidden = true;
    if (title) title.textContent = labels[key];
  };

  const readLocalImplantations = () => {
    try {
      const items = JSON.parse(window.localStorage.getItem(LOCAL_IMPLANTATIONS_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  };

  const implantationStatus = (item) => {
    if (item.completed) return ['CONCLUÍDA', 'is-completed'];
    if (item.paused) return ['PAUSADA', 'is-paused'];
    if (item.active !== false) return ['EM IMPLANTAÇÃO', ''];
    return ['INATIVA', 'is-inactive'];
  };

  const renderImplantationCards = (items) => {
    if (!items.length) {
      return '<div class="pmh-implant-command-empty">Nenhuma implantação encontrada no SULTS.</div>';
    }

    return `<div class="pmh-implant-command-list">${items.map((item) => {
      const [status, statusClass] = implantationStatus(item);
      const unit = item.unit || item.projectName || 'Unidade sem nome';
      const responsible = item.responsible || item.franchisee || 'Responsável não informado';
      const context = [item.category, item.model, item.location].filter(Boolean).join(' · ');
      const date = item.endDate || item.openingDate || item.startDate;
      return `
        <article class="pmh-implant-command-card">
          <div>
            <header><span class="${statusClass}">${status}</span></header>
            <h3>${esc(unit)}</h3>
            <p>${esc(context || 'Projeto de implantação')}<br>Responsável: ${esc(responsible)}</p>
          </div>
          <aside>
            <strong>${esc(formatDate(date))}</strong>
            <span>${item.source === 'sults' ? 'Sincronizado com o SULTS' : 'Cadastro manual'}</span>
          </aside>
          ${item.attentionNote ? `<div class="pmh-implant-command-note">Atenção: ${esc(item.attentionNote)}</div>` : ''}
        </article>`;
    }).join('')}</div>`;
  };

  const openImplantations = async (updateUrl = true) => {
    prepareNativeArea('inauguracoes');
    content.classList.remove('pmh-cc-embedded');
    content.innerHTML = `
      <section class="pmh-implant-command">
        <header class="pmh-implant-command-head">
          <div>
            <small>IMPLANTAÇÕES E INAUGURAÇÕES</small>
            <h2>Unidades no radar do Marketing</h2>
            <p>Acompanhe responsáveis, etapas e datas previstas em uma única tela.</p>
          </div>
          <button type="button">＋ Nova implantação</button>
        </header>
        <div class="pmh-implant-command-loading">Sincronizando implantações com o SULTS…</div>
      </section>`;

    if (updateUrl) history.replaceState(null, '', '#nucleo/inauguracoes');

    try {
      const response = await fetch(IMPLANTATIONS_API, { headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Falha ao consultar implantações');

      const sultsItems = Array.isArray(payload.data) ? payload.data : [];
      const localItems = readLocalImplantations();
      const items = [...sultsItems, ...localItems];
      const active = items.filter((item) => item.active !== false && !item.completed && !item.paused).length;
      const paused = items.filter((item) => item.paused).length;
      const completed = items.filter((item) => item.completed).length;
      const upcoming = items.filter((item) => {
        const rawDate = item.endDate || item.openingDate || item.startDate;
        if (!rawDate || item.completed) return false;
        const days = (new Date(rawDate).getTime() - Date.now()) / 86400000;
        return days >= 0 && days <= 45;
      }).length;

      const page = content.querySelector('.pmh-implant-command');
      if (!page) return;
      page.querySelector('.pmh-implant-command-loading')?.remove();
      page.insertAdjacentHTML('beforeend', `
        <section class="pmh-implant-command-summary">
          <article><small>TOTAL NO RADAR</small><strong>${items.length}</strong><span>Projetos encontrados</span></article>
          <article><small>ATIVAS</small><strong>${active}</strong><span>Em implantação</span></article>
          <article><small>PRÓXIMAS</small><strong>${upcoming}</strong><span>Nos próximos 45 dias</span></article>
          <article><small>PAUSADAS / CONCLUÍDAS</small><strong>${paused + completed}</strong><span>${paused} pausadas · ${completed} concluídas</span></article>
        </section>
        ${renderImplantationCards(items)}`);
    } catch (error) {
      const loading = content.querySelector('.pmh-implant-command-loading');
      if (loading) {
        loading.className = 'pmh-implant-command-error';
        loading.textContent = error instanceof Error ? error.message : String(error);
      }
    }
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
    if (normalizedKey === 'inauguracoes') {
      openImplantations(updateUrl);
      return;
    }

    prepareNativeArea(normalizedKey);
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
    if (frame && labels[route] && route !== 'inauguracoes') navigateFrame(frame, route);
  });

  let initialRoute = normalizeKey(window.location.hash.match(/^#nucleo\/(.+)$/)?.[1]);
  if (initialRoute === 'campanhas') initialRoute = 'calendario';
  if (labels[initialRoute]) window.setTimeout(() => openEmbedded(initialRoute, false), 0);
})();
