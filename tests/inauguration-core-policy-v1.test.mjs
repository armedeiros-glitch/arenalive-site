import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../planet-hub/assets/inauguration-core-policy-v1.js', import.meta.url), 'utf8');
const ownerRules = fs.readFileSync(new URL('../planet-hub/assets/inauguration-owner-rules-v1.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const oldChecklist = [
  ['Número de telefone para redes sociais', 'Franqueado', 30],
  ['Criação/ajuste do Instagram', 'Franqueado', 30],
  ['Criação/ajuste do Facebook', 'Franqueado', 30],
  ['Google Meu Negócio', 'Franqueado', 30],
  ['Vídeo de inauguração', 'Franqueadora', 20],
  ['Enviar @ dos influenciadores', 'Franqueado', 20],
  ['Contratar influenciadores', 'Franqueado', 15],
  ['Contratar Social Media para inauguração', 'Franqueado', 15],
  ['Contratar ornamentação / arco de bolas', 'Franqueado', 15],
  ['Aprovar artes inaugurais', 'Franqueadora', 12],
  ['Fazer 1000 panfletos', 'Franqueado', 10],
  ['Entregar panfletos para lojistas', 'Franqueado', 7],
  ['Configurar tráfego pago', 'Franqueadora', 7],
  ['Separar brindes/cupons', 'Franqueado', 5],
  ['Conferência final da operação', 'Franqueadora', 3],
].map(([action, owner, daysBefore], indexValue) => ({
  action,
  owner,
  daysBefore,
  done: indexValue === 5,
  ...(indexValue === 5 ? { ownerOverride: 'Equipe local', dueDate: '2026-09-01' } : {}),
}));

const storage = new Map([
  ['planet-hub-inaugurations-v2', JSON.stringify([{ id: 'legacy-local', checklist: oldChecklist }])],
]);
const eventListeners = new Map();
let lastRequest = null;

const nativeFetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url, 'https://andre-os.test');
  lastRequest = { input, init, url };

  if (url.pathname === '/api/hub/inauguracoes') {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : { data: [{ id: 'remote', checklist: oldChecklist }] };
    return new Response(JSON.stringify({ revision: 'r1', data: body.data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }

  if (url.pathname === '/api/sults/implantacoes') {
    return new Response(JSON.stringify({
      data: [
        { sultsProjectId: 1, unit: 'Planet Pausada', active: false, paused: true, completed: false, status: 'pausado' },
        { sultsProjectId: 2, unit: 'Planet Ativa', active: true, paused: false, completed: false, status: 'ativo' },
      ],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  });
};

const windowStub = {
  fetch: nativeFetch,
  location: { origin: 'https://andre-os.test' },
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  },
  addEventListener: (name, handler) => eventListeners.set(name, handler),
};
const documentStub = {
  addEventListener: () => {},
  querySelectorAll: () => [],
};

vm.runInNewContext(source, {
  window: windowStub,
  document: documentStub,
  URL,
  Request,
  Response,
  Headers,
  console,
});

const policy = windowStub.PlanetInaugurationCorePolicy;
assert.ok(policy, 'política canônica deve ficar disponível no runtime');
assert.equal(policy.VERSION, '20260828-1');

const normalized = policy.normalizeChecklist(oldChecklist);
assert.equal(normalized.length, 17, 'checklist legado de 15 etapas deve virar 17 antes do renderer');
assert.equal(normalized.find((item) => item.action === 'Criação/ajuste do Instagram').owner, 'Franqueadora');
assert.equal(normalized.find((item) => item.action === 'Criação/ajuste do Facebook').owner, 'Franqueadora');
assert.equal(normalized.find((item) => item.action === 'Google Meu Negócio').owner, 'Franqueadora');
assert.equal(normalized.find((item) => item.action === 'Vídeo de inauguração').owner, 'Franqueado');
assert.equal(normalized.find((item) => item.action === 'Contratar influenciadores').owner, 'Franqueadora');
assert.equal(normalized.find((item) => item.action === 'Contratar Social Media para inauguração').owner, 'Franqueadora');
assert.equal(normalized.find((item) => item.action === 'Contratar ornamentação / arco de bolas').owner, 'Franqueadora');

const influencerContact = normalized.find((item) => item.action === 'Enviar nomes/@ e contatos dos influenciadores locais');
assert.ok(influencerContact, 'nome legado de influenciadores deve ser canônico');
assert.equal(influencerContact.done, true, 'estado concluído da etapa existente deve ser preservado');
assert.equal(influencerContact.ownerOverride, 'Equipe local', 'override local deve ser preservado');
assert.equal(influencerContact.dueDate, '2026-09-01', 'prazo customizado deve ser preservado');
assert.ok(normalized.some((item) => item.action === 'Enviar contato/indicação de Social Media local'));
assert.ok(normalized.some((item) => item.action === 'Enviar contato/empresa de ornamentação / arco de bolas'));

const localAfterBoot = JSON.parse(storage.get('planet-hub-inaugurations-v2'));
assert.equal(localAfterBoot[0].checklist.length, 17, 'localStorage deve ser curado antes do hub carregar');

const putResponse = await windowStub.fetch('/api/hub/inauguracoes', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: [{ id: 'legacy-put', checklist: oldChecklist }], baseRevision: 'r0' }),
});
const sentBody = JSON.parse(lastRequest.init.body);
assert.equal(sentBody.data[0].checklist.length, 17, 'cliente antigo não pode persistir checklist de 15 etapas');
const putPayload = await putResponse.json();
assert.equal(putPayload.data[0].checklist.length, 17, 'resposta da API deve chegar canônica ao renderer');

const operationalResponse = await windowStub.fetch('/api/sults/implantacoes?start=0&limit=100');
const operational = await operationalResponse.json();
const paused = operational.data.find((item) => item.sultsProjectId === 1);
assert.equal(paused.sourceActive, false, 'flag original do SULTS deve permanecer auditável');
assert.equal(paused.operationalActive, true, 'projeto pausado continua dentro do escopo operacional');
assert.equal(paused.active, true, 'renderer legado deve enxergar projeto pausado e não escondê-lo');

const historicalResponse = await windowStub.fetch('/api/sults/implantacoes?start=0&limit=100&scope=all');
const historical = await historicalResponse.json();
const historicalPaused = historical.data.find((item) => item.sultsProjectId === 1);
assert.equal(historicalPaused.active, false, 'scope=all do EJECT deve preservar a flag bruta do SULTS');
assert.equal('sourceActive' in historicalPaused, false, 'adaptação operacional não pode contaminar o histórico');

const policyIndex = index.indexOf('inauguration-core-policy-v1.js?v=20260828-1');
const accessIndex = index.indexOf('hub-access-v1.js?v=20260828-4');
assert.ok(policyIndex >= 0 && accessIndex >= 0 && policyIndex < accessIndex,
  'política canônica precisa executar antes do bootstrap que carrega unified-hub');

const sharedRules = [
  ["criacao/ajuste do instagram", 'Franqueadora'],
  ["criacao/ajuste do facebook", 'Franqueadora'],
  ['google meu negocio', 'Franqueadora'],
  ['video de inauguracao', 'Franqueado'],
  ['contratar influenciadores', 'Franqueadora'],
  ['contratar social media para inauguracao', 'Franqueadora'],
  ['contratar ornamentacao / arco de bolas', 'Franqueadora'],
];
for (const [action, owner] of sharedRules) {
  const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`key === '${escaped}'.*return '${owner}'`);
  assert.match(source, pattern, `política canônica deve manter owner de ${action}`);
  assert.match(ownerRules, pattern, `owner-rules visual não pode divergir de ${action}`);
}

assert.match(source, /Checklist de 17 etapas e seis ações inaugurais com controle financeiro\./,
  'cópia exibida deve refletir o checklist canônico');
assert.match(source, /Implantações operacionais/,
  'cópia da tela deve incluir ativos e pausados sem chamar tudo de ativo');

console.log('Inaugurações: política canônica precede o hub, cura 15→17, preserva overrides e mantém pausados visíveis.');
