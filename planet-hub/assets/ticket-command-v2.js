(() => {
  'use strict';

  // Hotfix de estabilidade: a interpretação correta de "meus chamados" continua
  // sendo o vínculo oficial no SULTS (André como responsável ou apoio).
  // Mantemos este arquivo apenas como ponte para não depender de cache do HTML.
  if (window.TicketCommandFollowing?.activeMineTickets) return;
  if (document.querySelector('script[data-ticket-command-owner="v1"]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.dataset.ticketCommandOwner = 'v1';
  script.src = '/planet-hub/assets/ticket-command-v1.js?v=20260820-restore-1';
  script.onerror = () => console.error('[André OS] Falha ao carregar o owner de Chamados v1.');
  document.head.appendChild(script);
})();
