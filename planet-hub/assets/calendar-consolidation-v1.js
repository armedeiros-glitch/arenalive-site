(() => {
  const PRINCIPAL_COLOR = '#6d43d8';
  const PRINCIPAL_BACKGROUND = '#eee8ff';
  const DRAFT_KEY = 'planet-campaign-draft';

  const workflow = [
    ['Definir objetivo, período e mecânica', 'Marketing'],
    ['Validar custo, regras e adesão', 'Direção'],
    ['Criar conceito e peça principal', 'Criação'],
    ['Criar post para o feed', 'Design'],
    ['Criar sequência de stories', 'Design + Social'],
    ['Produzir Reel ou vídeo da campanha', 'Social media'],
    ['Produzir materiais de PDV e manual de execução', 'Marketing + Design'],
    ['Aprovar, publicar para a rede e acompanhar resultados', 'Marketing'],
  ];

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const ensureModal = (doc = document) => {
    let modal = doc.getElementById('pmh-campaign-modal');
    if (modal) return modal;

    modal = doc.createElement('div');
    modal.id = 'pmh-campaign-modal';
    modal.className = 'pmh-campaign-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="pmh-campaign-dialog" role="dialog" aria-modal="true" aria-labelledby="pmh-campaign-title">
        <header>
          <div>
            <small>NOVA CAMPANHA</small>
            <h2 id="pmh-campaign-title">Criar campanha</h2>
            <p>Ao continuar, estas ações entram como roteiro padrão da campanha.</p>
          </div>
          <button type="button" class="pmh-campaign-close" aria-label="Fechar">×</button>
        </header>
        <form class="pmh-campaign-form">
          <div class="pmh-campaign-fields">
            <label>
              Nome da campanha
              <input name="campaignName" required placeholder="Ex.: Primavera Planet" autocomplete="off">
            </label>
            <label>
              Data principal
              <input name="campaignDate" type="date">
            </label>
          </div>
          <p class="pmh-campaign-workflow-title">Ações geradas para a campanha</p>
          <ol class="pmh-campaign-workflow">
            ${workflow.map(([task, owner], index) => `
              <li>
                <span>${String(index + 1).padStart(2, '0')}</span>
                <div><strong>${task}</strong><small>${owner}</small></div>
                <input type="checkbox" name="campaignAction" value="${task}" checked aria-label="Incluir ${task}">
              </li>`).join('')}
          </ol>
          <footer>
            <button type="button" class="pmh-campaign-cancel">Cancelar</button>
            <button type="submit" class="pmh-campaign-continue">Continuar para o cadastro →</button>
          </footer>
        </form>
      </section>`;
    doc.body.appendChild(modal);

    const close = () => {
      modal.hidden = true;
      doc.body.style.overflow = '';
    };

    modal.querySelector('.pmh-campaign-close')?.addEventListener('click', close);
    modal.querySelector('.pmh-campaign-cancel')?.addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.hidden) close();
    });

    modal.querySelector('form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const formData = new FormData(form);
      const draft = {
        name: String(formData.get('campaignName') || '').trim(),
        date: String(formData.get('campaignDate') || ''),
        actions: formData.getAll('campaignAction').map(String),
        createdAt: new Date().toISOString(),
      };
      if (!draft.name) return;
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch (_) {}
      close();
      try {
        window.top.location.href = '/publicar?source=calendar';
      } catch (_) {
        window.location.href = '/publicar?source=calendar';
      }
    });

    return modal;
  };

  const openModal = (doc = document) => {
    const modal = ensureModal(doc);
    modal.hidden = false;
    doc.body.style.overflow = 'hidden';
    window.setTimeout(() => modal.querySelector('input[name="campaignName"]')?.focus(), 20);
  };

  const stylePrincipalCampaigns = (doc) => {
    const articles = [...doc.querySelectorAll('#root article')];
    articles.forEach((article) => {
      const typeLabel = [...article.querySelectorAll('span')]
        .find((span) => normalize(span.textContent) === 'principal');
      if (!typeLabel) return;

      article.dataset.pmhCampaignType = 'principal';
      const monthBlock = article.firstElementChild;
      if (monthBlock) {
        monthBlock.style.setProperty('color', PRINCIPAL_COLOR, 'important');
        monthBlock.style.setProperty('background', PRINCIPAL_BACKGROUND, 'important');
      }

      typeLabel.style.setProperty('color', PRINCIPAL_COLOR, 'important');
      typeLabel.style.setProperty('background', PRINCIPAL_BACKGROUND, 'important');
      typeLabel.style.setProperty('border-radius', '999px', 'important');
      typeLabel.style.setProperty('padding', '4px 8px', 'important');

      const progress = [...article.querySelectorAll('i')]
        .find((element) => element.style.width);
      if (progress) progress.style.setProperty('background', PRINCIPAL_COLOR, 'important');
    });
  };

  const decorateNativeDocument = (doc) => {
    if (!doc?.body) return;

    const decorate = () => {
      stylePrincipalCampaigns(doc);

      [...doc.querySelectorAll('#root a, #root button')].forEach((element) => {
        const text = normalize(element.textContent);
        if (!text.includes('publicar campanha') && !text.includes('criar campanha')) return;
        element.textContent = '＋ Criar campanha';
        if (element.dataset.pmhCampaignHooked === '1') return;
        element.dataset.pmhCampaignHooked = '1';
        element.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
          openModal(doc);
        }, true);
      });
    };

    decorate();
    if (!doc.body.dataset.pmhCampaignObserver) {
      doc.body.dataset.pmhCampaignObserver = '1';
      new MutationObserver(decorate).observe(doc.getElementById('root') || doc.body, {
        childList: true,
        subtree: true,
      });
    }
  };

  const shell = document.getElementById('pmh-command-center');
  if (!shell) {
    decorateNativeDocument(document);
    return;
  }

  const title = shell.querySelector('[data-pmh-title]');
  const topActions = shell.querySelector('.pmh-cc-top-actions');
  let createButton = shell.querySelector('.pmh-create-campaign-button');
  if (!createButton && topActions) {
    createButton = document.createElement('button');
    createButton.type = 'button';
    createButton.className = 'pmh-create-campaign-button';
    createButton.textContent = '＋ Criar campanha';
    createButton.addEventListener('click', () => openModal(document));
    topActions.insertBefore(createButton, topActions.lastElementChild);
  }

  const cleanShell = () => {
    shell.querySelectorAll('[data-pmh-open="campanhas"]').forEach((element) => element.remove());

    shell.querySelectorAll('[data-pmh-open="calendario"]').forEach((element) => {
      const strong = element.querySelector('strong');
      const small = element.querySelector('small');
      if (strong) strong.textContent = 'Calendário';
      if (small) small.textContent = 'Campanhas, datas e entregas';
      if (!strong && element.closest('nav')) element.innerHTML = '<span>▦</span>Calendário';
    });

    const calendarOpen = normalize(title?.textContent).includes('calendario') ||
      /^#nucleo\/(calendario|campanhas)$/.test(window.location.hash);
    document.body.classList.toggle('pmh-calendar-open', calendarOpen);

    shell.querySelectorAll('.pmh-cc-embedded-frame').forEach((frame) => {
      if (frame.dataset.pmhCampaignFrameHooked === '1') return;
      frame.dataset.pmhCampaignFrameHooked = '1';
      const decorateFrame = () => {
        try {
          decorateNativeDocument(frame.contentDocument);
        } catch (_) {}
      };
      frame.addEventListener('load', decorateFrame);
      decorateFrame();
    });
  };

  cleanShell();
  new MutationObserver(cleanShell).observe(shell, { childList: true, subtree: true });
  window.addEventListener('hashchange', cleanShell);
})();
