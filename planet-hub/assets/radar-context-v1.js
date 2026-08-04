(() => {
  'use strict';

  const API = '/api/hub/radar-contextos';
  const STATES = {
    actionable: 'Posso agir agora',
    blocked: 'Bloqueado por alguém ou setor',
    waiting_info: 'Aguardando informação ou material',
    waiting_approval: 'Aguardando aprovação',
    scheduled: 'Retomar em outra data',
  };

  window.PMHRadarContext = { API, STATES };
})();
