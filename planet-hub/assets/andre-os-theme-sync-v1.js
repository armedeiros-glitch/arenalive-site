(() => {
  'use strict';

  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const dark = query.matches;
    document.documentElement.dataset.aosTheme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#111015' : '#f4f4f8');
  };

  apply();
  query.addEventListener?.('change', apply);
})();
