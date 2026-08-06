(() => {
  'use strict';

  const DESKTOP_MIN = 821;
  const MAX_OTHER_ITEMS = 3;
  let buildFrame = 0;

  const desktopViewport = () => (Number(window.innerWidth) || 0) >= DESKTOP_MIN;
  const cockpit = () => document.querySelector('[data-decision-cockpit]');
  const cleanText = (element) => String(element?.textContent || '').replace(/\s+/g, ' ').trim();
  const toneFrom = (element) => [...(element?.classList || [])]
    .find((name) => name.startsWith('tone-'))
    ?.slice(5) || 'execution';

  const makeElement = (tag, className, text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const primaryEntry = (target) => {
    const main = target.querySelector('.pmh-decision-main');
    const action = target.querySelector('.pmh-decision-actions [data-attention-open]');
    const title = cleanText(main?.querySelector('h2'));
    if (!main || !action || !title) return null;

    const kind = main.querySelector('.pmh-decision-kind');
    return {
      id: String(action.dataset.attentionOpen || ''),
      kind: cleanText(kind) || '🎯 Execução',
      tone: toneFrom(kind),
      title,
      summary: cleanText(main.querySelector('.pmh-decision-next strong')) || cleanText(main.querySelector(':scope > p')),
      origin: cleanText(main.querySelector('.pmh-active-origin')),
      due: cleanText(main.querySelector('.pmh-decision-meta time')),
      dueTone: main.querySelector('.pmh-decision-meta time')?.className || '',
    };
  };

  const secondaryEntries = (target, primaryId) => [...target.querySelectorAll('.pmh-attention-card[data-attention-open]')]
    .map((card) => ({
      id: String(card.dataset.attentionOpen || ''),
      kind: cleanText(card.querySelector('.pmh-attention-kind')) || '🎯 Execução',
      tone: toneFrom(card),
      title: cleanText(card.querySelector('strong')),
      summary: cleanText(card.querySelector('small')),
      origin: cleanText(card.querySelector('footer span')),
      due: cleanText(card.querySelector('footer time')),
      dueTone: card.querySelector('footer time')?.className || '',
    }))
    .filter((entry) => entry.id && entry.title && entry.id !== primaryId)
    .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index)
    .slice(0, MAX_OTHER_ITEMS);

  const buildCard = (entry, variant) => {
    const card = makeElement('article', `pmh-desktop-priority-card is-${variant} tone-${entry.tone}`);
    const head = makeElement('header', 'pmh-desktop-priority-card-head');
    head.append(
      makeElement('span', 'pmh-desktop-priority-kind', entry.kind),
      makeElement('time', `pmh-desktop-priority-due ${entry.dueTone}`.trim(), entry.due || 'Sem prazo'),
    );

    const movement = makeElement('div', 'pmh-desktop-priority-movement');
    movement.append(
      makeElement('small', '', 'PRÓXIMO MOVIMENTO'),
      makeElement('p', '', entry.summary || 'Abrir a tarefa e definir o próximo passo.'),
    );

    const footer = makeElement('footer', 'pmh-desktop-priority-card-footer');
    footer.appendChild(makeElement('span', 'pmh-desktop-priority-origin', entry.origin || 'Radar André'));
    const open = makeElement('button', 'pmh-desktop-priority-open', variant === 'focus' ? 'Abrir tarefa' : 'Abrir');
    open.type = 'button';
    open.dataset.attentionOpen = entry.id;
    footer.appendChild(open);

    card.append(head, makeElement('h3', '', entry.title), movement, footer);
    return card;
  };

  const buildLayout = () => {
    buildFrame = 0;
    const target = cockpit();
    if (!target) return;

    if (!desktopViewport()) {
      target.classList.remove('pmh-desktop-priority-ready');
      target.querySelector('[data-desktop-priority-layout]')?.remove();
      return;
    }

    const primary = primaryEntry(target);
    if (!primary) {
      target.classList.remove('pmh-desktop-priority-ready');
      target.querySelector('[data-desktop-priority-layout]')?.remove();
      return;
    }

    const others = secondaryEntries(target, primary.id);
    const signature = [primary, ...others]
      .map((entry) => [entry.id, entry.title, entry.summary, entry.due].join('|'))
      .join('::');
    const current = target.querySelector('[data-desktop-priority-layout]');
    if (current?.dataset.prioritySignature === signature) {
      target.classList.add('pmh-desktop-priority-ready');
      return;
    }

    const layout = makeElement('div', 'pmh-desktop-priority-layout');
    layout.dataset.desktopPriorityLayout = '1';
    layout.dataset.prioritySignature = signature;

    const focusSection = makeElement('section', 'pmh-desktop-priority-focus-section');
    const focusHead = makeElement('header', 'pmh-desktop-priority-section-head');
    focusHead.appendChild(makeElement('small', '', '🤖 O QUE PRECISA DA SUA ATENÇÃO AGORA'));
    focusSection.append(focusHead, buildCard(primary, 'focus'));
    layout.appendChild(focusSection);

    if (others.length) {
      const othersSection = makeElement('section', 'pmh-desktop-priority-others-section');
      const othersHead = makeElement('header', 'pmh-desktop-priority-section-head');
      const copy = makeElement('div', '');
      copy.append(
        makeElement('small', '', 'OUTROS PONTOS QUE MERECEM ATENÇÃO'),
        makeElement('strong', '', `${others.length} ponto${others.length > 1 ? 's' : ''} complementar${others.length > 1 ? 'es' : ''}`),
      );
      othersHead.appendChild(copy);
      const grid = makeElement('div', 'pmh-desktop-priority-grid');
      others.forEach((entry) => grid.appendChild(buildCard(entry, 'other')));
      othersSection.append(othersHead, grid);
      layout.appendChild(othersSection);
    }

    current?.remove();
    target.prepend(layout);
    target.classList.add('pmh-desktop-priority-ready');
  };

  const scheduleBuild = () => {
    const target = cockpit();
    if (target && !target.querySelector('[data-desktop-priority-layout]')) {
      target.classList.remove('pmh-desktop-priority-ready');
    }
    if (!buildFrame) buildFrame = requestAnimationFrame(buildLayout);
    window.setTimeout(buildLayout, 90);
    window.setTimeout(buildLayout, 240);
  };

  window.addEventListener('pmh:radar-data', scheduleBuild);
  window.addEventListener('pmh:view-rendered', scheduleBuild);
  window.addEventListener('resize', scheduleBuild, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleBuild, { once: true });
  } else {
    scheduleBuild();
  }
})();
