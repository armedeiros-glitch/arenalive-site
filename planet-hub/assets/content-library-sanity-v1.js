(() => {
  'use strict';

  window.addEventListener('error', (event) => {
    const source = String(event.filename || '');
    if (!source.includes('content-library')) return;
    console.error('Falha no módulo de Conteúdos:', event.error || event.message);
  });
})();
