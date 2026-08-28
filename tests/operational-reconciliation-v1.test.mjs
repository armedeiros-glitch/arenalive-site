import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestPost } from '../functions/api/hub/radar-contextos.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const home = read('planet-hub/assets/andre-os-radar-home-v1.js');
const service = read('planet-hub/assets/andre-os-operational-reconciliation-v1.js');
const radarData = read('planet-hub/assets/radar-data-v1.js');
const access = read('planet-hub/assets/hub-access-v1.js');

assert.match(home, /RADAR PESSOAL/,
  'Home deve identificar explicitamente que o foco vem do Radar pessoal');
assert.match(home, /OPERAÇÃO PLANET/,
  'Home deve mostrar a atenção operacional em um bloco separado');
assert.match(home, /A situação da Planet é mostrada separadamente/,
  'fila pessoal limpa não pode significar operação limpa');
assert.match(home, /AndreOSOperationalAttention/,
  'Home deve consumir a camada de reconciliação operacional sem transformar operação em tarefa');
assert.match(service, /PMHRadarData\.collect/,
  'reconciliação deve reaproveitar o RadarData operacional existente');
assert.match(service, /INAUGURATIONS_API = '\/api\/hub\/inauguracoes'/,
  'atenção operacional deve reaproveitar a fonte oficial de inaugurações');
assert.match(service, /PMHInaugurationTiming\.attentionItems/,
  'timing do checklist deve alimentar a atenção operacional');
assert.match(service, /itemOwnership\(item\) === 'info'/,
  'itens meramente informativos não devem virar atenção do André');
assert.match(service, /roleFor[\s\S]*itemOwnership\(item\) === 'mine' \? 'mine' : 'tracking'/,
  'atenção deve distinguir minha ação de acompanhamento');
assert.match(service, /mergeTimedInaugurations/,
  'timing das inaugurações deve herdar contexto salvo em vez de criar estado paralelo');
assert.match(service, /sources\.contexts\?\.reliability !== 'fresh'/,
  'contextos só podem ser limpos quando a própria fonte de contextos estiver confiável');
assert.match(service, /sources\[key\]\?\.reliability === 'fresh'/,
  'cada escopo só pode ser reconciliado quando sua fonte respondeu com sucesso');
assert.match(service, /activeItemIds/,
  'reconciliação deve preservar os IDs que continuam ativos');
assert.match(radarData, /typeof raw === 'object'.*Number\(raw\.id/s,
  'RadarData deve aceitar situation do SULTS tanto como objeto quanto como número');
assert.match(radarData, /\[2, 3\]\.includes\(ticketSituationId\(item\)\)/,
  'situações finais numéricas devem sair da fila ativa');
assert.match(radarData, /ticketHasAndreSupport/,
  'papel de acompanhamento do André deve considerar a lista de apoio do chamado');
assert.match(radarData, /ownership: ticketOwnership\(item\)/,
  'chamados devem expor mine, tracking ou info em vez de tratar toda a fila como ação do André');
assert.match(access, /inauguration-timing-core-v1\.js\?v=20260828-1/,
  'bootstrap autenticado deve carregar o núcleo temporal das inaugurações');
assert.match(access, /andre-os-operational-reconciliation-v1\.js\?v=20260828-2/,
  'bootstrap autenticado deve invalidar o cache da reconciliação atualizada');
assert.match(access, /andre-os-radar-home-v1\.js\?v=20260828-1/,
  'bootstrap deve manter a Home atual');

class MemoryStore {
  constructor(document) {
    this.value = JSON.stringify(document);
  }

  async get(_key, options = {}) {
    return options.type === 'json' ? JSON.parse(this.value) : this.value;
  }

  async put(_key, value) {
    this.value = value;
  }
}

const store = new MemoryStore({
  revision: 'before',
  updatedAt: '2026-08-28T10:00:00.000Z',
  data: [
    { itemId: 'ticket-111', state: 'blocked', reason: 'órfão', followUpDate: '2026-08-21' },
    { itemId: 'ticket-222', state: 'blocked', reason: 'continua ativo', followUpDate: '2026-08-29' },
    { itemId: 'demand-333', state: 'actionable', reason: 'outro escopo' },
    { itemId: 'legacy-custom-1', state: 'blocked', reason: 'não reconciliável' },
  ],
});

const response = await onRequestPost({
  env: { PLANET_HUB_DATA: store },
  request: new Request('https://andre-os.local/api/hub/radar-contextos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prefixes: ['ticket-'],
      activeItemIds: ['ticket-222'],
    }),
  }),
});
const payload = await response.json();

assert.equal(response.status, 200);
assert.deepEqual(payload.removed, ['ticket-111'],
  'somente o contexto órfão do escopo autoritativo deve ser removido');
assert.deepEqual(payload.data.map((item) => item.itemId).sort(),
  ['demand-333', 'legacy-custom-1', 'ticket-222'].sort(),
  'contextos ativos, escopos não consultados e IDs legados devem ser preservados');

const invalid = await onRequestPost({
  env: { PLANET_HUB_DATA: store },
  request: new Request('https://andre-os.local/api/hub/radar-contextos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: ['qualquer-coisa-'], activeItemIds: [] }),
  }),
});
assert.equal(invalid.status, 400,
  'backend deve rejeitar escopos arbitrários para impedir limpeza ampla acidental');

console.log('André OS: separação pessoal/operação, SULTS, timing e reconciliação conservadora validados.');
