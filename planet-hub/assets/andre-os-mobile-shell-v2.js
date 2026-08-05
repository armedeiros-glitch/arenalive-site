(() => {
  'use strict';

  const ensureStyle = () => {
    if (document.querySelector('link[data-mobile-sidebar-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/planet-hub/assets/andre-os-mobile-sidebar-v1.css?v=20260805-2';
    link.dataset.mobileSidebarStyle = '1';
    document.head.appendChild(link);
  };

  const ensureScript = (src, marker) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  };

  ensureStyle();
  ensureScript('/planet-hub/assets/andre-os-mobile-sidebar-v1.js?v=20260805-1', 'data-mobile-sidebar-runtime');
  ensureScript('/planet-hub/assets/planet-expansion-navigation-v1.js?v=20260805-1', 'data-expansion-navigation-runtime');
})();
