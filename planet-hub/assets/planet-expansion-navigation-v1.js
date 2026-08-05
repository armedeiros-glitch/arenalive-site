(() => {
  'use strict';

  const normalize = () => {
    const nav = document.querySelector('.pmh-sidebar nav');
    if (!nav) return;

    let button = nav.querySelector(':scope > [data-expansion-nav]');
    if (!button) return;

    button.type = 'button';
    button.dataset.view = 'expansao';
    button.classList.add('pmh-expansion-nav');
    button.setAttribute('aria-label', 'Expansão');

    let icon = button.querySelector(':scope > i');
    if (!icon) {
      icon = document.createElement('i');
      button.prepend(icon);
    }
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '↗';

    [...button.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .forEach((node) => node.remove());

    let label = button.querySelector(':scope > .aos-mobile-nav-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'aos-mobile-nav-label';
      button.insertBefore(label, button.querySelector(':scope > b'));
    }
    label.textContent = 'Expansão';
    label.dataset.fullLabel = 'Expansão';

    const inauguration = nav.querySelector(':scope > [data-view="inauguracoes"]');
    if (inauguration && button.previousElementSibling !== inauguration) {
      inauguration.insertAdjacentElement('afterend', button);
    }

    window.dispatchEvent(new CustomEvent('pmh:navigation-updated', { detail: { view: 'expansao' } }));
  };

  const observer = new MutationObserver(normalize);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('pmh:view-rendered', normalize);
  window.addEventListener('pmh:access-ready', normalize);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', normalize, { once: true });
  else normalize();
})();
