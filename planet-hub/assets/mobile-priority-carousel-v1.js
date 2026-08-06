(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const MAX_OTHER_ITEMS = 3;
  let buildFrame = 0;
  let scrollFrame = 0;

  const mobileViewport = () => {
    const viewport = Number(window.innerWidth) || 9999;
    const screenWidth = Number(window.screen?.width) || viewport;
    return Math.min(viewport, screenWidth) <= MOBILE_MAX;
  };

  const cockpit = () => document.querySelector('[data-decision-cockpit]');
  const cleanText = (element) => String(element?.textContent || '').replace(/\s+/g, ' ').trim();
  const toneFrom = (element) => [...(element?.classList || [])]
    .find((name) => name.startsWith('tone-'))
    ?.slice(5) || 'execution';

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
      summary: cleanText(main.querySelector('.pmh-decision-next strong'))
        || cleanText(main.querySelector(':scope > p')),
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

  const makeElement = (tag, className, text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const buildTaskCard = (entry, variant, index = 0, total = 1) => {
    const card = makeElement('article', `pmh-priority-card pmh-priority-${variant} tone-${entry.tone}`);
    if (variant === 'other') {
      card.dataset.prioritySlide = String(index);
      card.setAttribute('aria-label', `Outro ponto ${index + 1} de ${total}`);
    }

    const head = makeElement('header', 'pmh-priority-card-head');
    head.append(
      makeElement('span', 'pmh-priority-kind', entry.kind),
      makeElement('time', `pmh-priority-due ${entry.dueTone}`.trim(), entry.due || 'Sem prazo'),
    );

    const title = makeElement('h3', '', entry.title);
    const movement = makeElement('div', 'pmh-priority-movement');
    movement.append(
      makeElement('small', '', 'PRÓXIMO MOVIMENTO'),
      makeElement('p', '', entry.summary || 'Abrir a tarefa e definir o próximo passo.'),
    );

    const footer = makeElement('footer', 'pmh-priority-card-footer');
    footer.appendChild(makeElement('span', 'pmh-priority-origin', entry.origin || 'Radar André'));
    const open = makeElement('button', 'pmh-priority-open', variant === 'focus' ? 'Abrir tarefa' : 'Abrir');
    open.type = 'button';
    open.dataset.attentionOpen = entry.id;
    footer.appendChild(open);

    card.append(head, title, movement, footer);
    return card;
  };

  const updateOthersState = (section, index) => {
    if (!section) return;
    const total = Number(section.dataset.priorityTotal || 1);
    const safeIndex = Math.max(0, Math.min(total - 1, Number(index) || 0));
    section.dataset.priorityIndex = String(safeIndex);
    const counter = section.querySelector('[data-priority-counter]');
    if (counter) counter.textContent = `${safeIndex + 1} de ${total}`;
    section.querySelectorAll('[data-priority-dot]').forEach((dot, dotIndex) => {
      const active = dotIndex === safeIndex;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });
  };

  const onTrackScroll = (track) => {
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      const slides = [...track.querySelectorAll('[data-priority-slide]')];
      if (!slides.length) return;
      const trackLeft = track.getBoundingClientRect().left;
      const index = slides.reduce((best, slide, current) => {
        const distance = Math.abs(slide.getBoundingClientRect().left - trackLeft);
        return distance < best.distance ? { index: current, distance } : best;
      }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
      updateOthersState(track.closest('[data-priority-others]'), index);
    });
  };

  const buildFocusSection = (entry) => {
    const section = makeElement('section', 'pmh-priority-focus-section');
    section.dataset.priorityFocus = '1';
    section.setAttribute('aria-label', 'O que precisa da sua atenção agora');

    const heading = makeElement('header', 'pmh-priority-section-head');
    heading.appendChild(makeElement('small', '', '🤖 O QUE PRECISA DA SUA ATENÇÃO AGORA'));
    section.append(heading, buildTaskCard(entry, 'focus'));
    return section;
  };

  const buildOthersSection = (entries) => {
    if (!entries.length) return null;

    const section = makeElement('section', 'pmh-priority-others-section');
    section.dataset.priorityOthers = '1';
    section.dataset.priorityTotal = String(entries.length);
    section.dataset.priorityIndex = '0';
    section.setAttribute('aria-label', 'Outros pontos que merecem atenção');

    const heading = makeElement('header', 'pmh-priority-section-head pmh-priority-others-head');
    const copy = makeElement('div', '');
    copy.append(
      makeElement('small', '', 'OUTROS PONTOS QUE MERECEM ATENÇÃO'),
      makeElement('strong', '', 'Continue arrastando para ver'),
    );
    const counter = makeElement('span', 'pmh-priority-counter', `1 de ${entries.length}`);
    counter.dataset.priorityCounter = '1';
    heading.append(copy, counter);

    const track = makeElement('div', 'pmh-priority-track');
    track.dataset.priorityTrack = '1';
    track.tabIndex = 0;
    track.setAttribute('aria-label', 'Arraste para ver outros pontos de atenção');
    entries.forEach((entry, index) => track.appendChild(buildTaskCard(entry, 'other', index, entries.length)));
    track.addEventListener('scroll', () => onTrackScroll(track), { passive: true });

    const controls = makeElement('footer', 'pmh-priority-controls');
    const dots = makeElement('div', 'pmh-priority-dots');
    entries.forEach((entry, index) => {
      const dot = makeElement('button', index === 0 ? 'active' : '');
      dot.type = 'button';
      dot.dataset.priorityDot = String(index);
      dot.setAttribute('aria-label', `Ver outro ponto ${index + 1}: ${entry.title}`);
      dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');
      dots.appendChild(dot);
    });
    controls.append(dots, makeElement('span', 'pmh-priority-hint', entries.length > 1 ? 'Arraste para o lado' : 'Mais um ponto'));

    section.append(heading, track, controls);
    return section;
  };

  const buildMobileLayout = () => {
    buildFrame = 0;
    const target = cockpit();
    if (!target) return;

    if (!mobileViewport()) {
      target.classList.remove('pmh-priority-ready');
      target.querySelector('[data-priority-mobile]')?.remove();
      return;
    }

    const primary = primaryEntry(target);
    if (!primary) {
      target.classList.remove('pmh-priority-ready');
      target.querySelector('[data-priority-mobile]')?.remove();
      return;
    }

    const others = secondaryEntries(target, primary.id);
    const signature = [primary, ...others]
      .map((entry) => [entry.id, entry.title, entry.summary, entry.due].join('|'))
      .join('::');
    const current = target.querySelector('[data-priority-mobile]');
    if (current?.dataset.prioritySignature === signature) {
      target.classList.add('pmh-priority-ready');
      return;
    }

    const mobile = makeElement('div', 'pmh-priority-mobile');
    mobile.dataset.priorityMobile = '1';
    mobile.dataset.prioritySignature = signature;
    mobile.appendChild(buildFocusSection(primary));
    const othersSection = buildOthersSection(others);
    if (othersSection) mobile.appendChild(othersSection);

    current?.remove();
    target.prepend(mobile);
    target.classList.add('pmh-priority-ready');
  };

  const scheduleBuild = () => {
    if (!buildFrame) buildFrame = requestAnimationFrame(buildMobileLayout);
    window.setTimeout(buildMobileLayout, 90);
    window.setTimeout(buildMobileLayout, 240);
  };

  document.addEventListener('click', (event) => {
    const dot = event.target.closest?.('[data-priority-dot]');
    if (!dot) return;
    const section = dot.closest('[data-priority-others]');
    const track = section?.querySelector('[data-priority-track]');
    const slide = track?.querySelector(`[data-priority-slide="${dot.dataset.priorityDot}"]`);
    if (slide && track) track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
  });

  window.addEventListener('pmh:radar-data', scheduleBuild);
  window.addEventListener('pmh:view-rendered', scheduleBuild);
  window.addEventListener('resize', scheduleBuild, { passive: true });
  window.addEventListener('orientationchange', scheduleBuild, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleBuild, { once: true });
  } else {
    scheduleBuild();
  }
})();
