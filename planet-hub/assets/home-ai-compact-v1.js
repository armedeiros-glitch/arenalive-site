(() => {
  'use strict';

  const onViewRendered = (event) => {
    if (event.detail?.view !== 'inicio') return;
    document.dispatchEvent(new CustomEvent('pmh:home-mounted', {
      detail: { content: event.detail.content || null },
    }));
  };

  window.addEventListener('pmh:view-rendered', onViewRendered);
})();
