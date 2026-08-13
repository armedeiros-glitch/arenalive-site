(() => {
  'use strict';

  const detectContentPlatform = (value) => {
    try {
      const url = new URL(String(value || ''));
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      const host = url.hostname.toLowerCase();
      const path = url.pathname.toLowerCase();
      if (host === 'docs.google.com') {
        if (path.startsWith('/document')) return 'Google Docs';
        if (path.startsWith('/spreadsheets')) return 'Google Sheets';
        if (path.startsWith('/presentation')) return 'Google Slides';
      }
      if (host === 'drive.google.com') return 'Google Drive';
      if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'youtu.be') return 'YouTube';
      if (host === 'canva.com' || host === 'www.canva.com') return 'Canva';
      return 'Link externo';
    } catch {
      return '';
    }
  };

  const decorateLinks = (root = document) => {
    root.querySelectorAll?.('.pmh-asset-card footer a[href]').forEach((link) => {
      if (link.previousElementSibling?.classList?.contains('pmh-asset-link-origin')) return;
      const platform = detectContentPlatform(link.getAttribute('href'));
      if (!platform) return;
      const label = document.createElement('span');
      label.className = 'pmh-asset-link-origin';
      label.textContent = `${platform} ·`;
      link.parentNode?.insertBefore(label, link);
    });
  };

  const scheduleDecorate = () => requestAnimationFrame(() => decorateLinks());

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

  const observer = new MutationObserver(scheduleDecorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.PlanetContentPlatform = Object.freeze({ detectContentPlatform });
  scheduleDecorate();
})();
