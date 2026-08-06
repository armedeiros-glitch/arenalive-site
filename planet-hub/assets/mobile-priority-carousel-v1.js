(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const MAX_ITEMS = 4;
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

  const secondaryEntries = (target) => [...target.querySelectorAll('.pmh-attention-card[data-attention-open]')]
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
    .filter((entry) => entry.id && entry.title);

  const readEntries = (target) => {
    const primary = primaryEntry(target);
    if (!primary) return [];
    return [primary, ...secondaryEntries(target)]
      .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.id === entry.id) === index)
      .slice(0, MAX_ITEMS);
  };

  const makeElement = (tag, className, text = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const buildSlide = (entry, index, total) => {
    const slide = makeElement('article', `pmh-priority-slide tone-${entry.tone}`);
    slide.dataset.prioritySlide = String(index);
    slide.setAttribute('aria-label', `Prioridade ${index + 1} de ${total}`);

    const head = makeElement('header', 'pmh-priority-slide-head');
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

    const footer = makeElement('footer', 'pmh-priority-slide-footer');
    footer.appendChild(makeElement('span', 'pmh-priority-origin', entry.origin || 'Radar André'));
    const open = makeElement('button', 'pmh-priority-open', 'Abrir tarefa');
    open.type = 'button';
    open.dataset.attentionOpen = entry.id;
    footer.appendChild(open);

    slide.append(head, title, movement, footer);
    return slide;
  };

  const updateDeckState = (deck, index) => {
    const total = Number(deck.dataset.priorityTotal || 1);
    const safeIndex = Math.max(0, Math.min(total - 1, Number(index) || 0));
    deck.dataset.priorityIndex = String(safeIndex);
    const counter = deck.querySelector('[data-priority-counter]');
    if (counter) counter.textContent = `${safeIndex + 1} de ${total}`;
    deck.querySelectorAll('[data-priority-dot]').forEach((dot, dotIndex) => {
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
      updateDeckState(track.closest('[data-priority-deck]'), index);
    });
  };

  const buildDeck = () => {
    buildFrame = 0;
    const target = cockpit();
    if (!target) return;

    if (!mobileViewport()) {
      target.classList.remove('pmh-priority-ready');
      target.querySelector('[data-priority-deck]')?.remove();
      return;
    }

    const entries = readEntries(target);
    if (!entries.length) {
      target.classList.remove('pmh-priority-ready');
      target.querySelector('[data-priority-deck]')?.remove();
      return;
    }

    const signature = entries
      .map((entry) => [entry.id, entry.title, entry.summary, entry.due].join('|'))
      .join('::');
    const current = target.querySelector('[data-priority-deck]');
    if (current?.dataset.prioritySignature === signature) {
      target.classList.add('pmh-priority-ready');
      return;
    }

    const deck = makeElement('section', `pmh-priority-deck${entries.length === 1 ? ' is-single' : ''}`);
    deck.dataset.priorityDeck = '1';
    deck.dataset.prioritySignature = signature;
    deck.dataset.priorityTotal = String(entries.length);
    deck.dataset.priorityIndex = '0';
    deck.setAttribute('aria-label', 'Prioridades que precisam de atenção');

    const heading = makeElement('header', 'pmh-priority-deck-head');
    const headingCopy = makeElement('div', '');
    headingCopy.append(
      makeElement('small', '', 'O QUE PRECISA DA SUA ATENÇÃO AGORA'),
      makeElement('strong', '', 'Prioridades do Radar'),
    );
    const counter = makeElement('span', 'pmh-priority-counter', `1 de ${entries.length}`);
    counter.dataset.priorityCounter = '1';
    heading.append(headingCopy, counter);

    const track = makeElement('div', 'pmh-priority-track');
    track.dataset.priorityTrack = '1';
    track.setAttribute('tabindex', '0');
    track.setAttribute('aria-label', 'Arraste para ver outras prioridades');
    entries.forEach((entry, index) => track.appendChild(buildSlide(entry, index, entries.length)));
    track.addEventListener('scroll', () => onTrackScroll(track), { passive: true });

    const controls = makeElement('footer', 'pmh-priority-controls');
    const dots = makeElement('div', 'pmh-priority-dots');
    entries.forEach((entry, index) => {
      const dot = makeElement('button', index === 0 ? 'active' : '');
      dot.type = 'button';
      dot.dataset.priorityDot = String(index);
      dot.setAttribute('aria-label', `Ver prioridade ${index + 1}: ${entry.title}`);
      dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');
      dots.appendChild(dot);
    });
    controls.append(dots, makeElement('span', 'pmh-priority-hint', entries.length > 1 ? 'Arraste para o lado' : 'Foco principal'));

    deck.append(heading, track, controls);
    current?.remove();
    target.prepend(deck);
    target.classList.add('pmh-priority-ready');
  };

  const scheduleBuild = () => {
    if (!buildFrame) buildFrame = requestAnimationFrame(buildDeck);
    window.setTimeout(buildDeck, 90);
    window.setTimeout(buildDeck, 240);
  };

  document.addEventListener('click', (event) => {
    const dot = event.target.closest?.('[data-priority-dot]');
    if (!dot) return;
    const deck = dot.closest('[data-priority-deck]');
    const track = deck?.querySelector('[data-priority-track]');
    const slide = track?.querySelector(`[data-priority-slide="${dot.dataset.priorityDot}"]`);
    if (slide && track) {
      track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    }
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
