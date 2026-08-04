(() => {
  'use strict';

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-content-filter="search"]');
    if (!input) return;

    const value = input.value;
    requestAnimationFrame(() => {
      const next = document.querySelector('[data-content-filter="search"]');
      if (!next || document.activeElement === next) return;
      next.focus();
      next.setSelectionRange(value.length, value.length);
    });
  });
})();
