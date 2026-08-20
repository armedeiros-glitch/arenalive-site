import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../planet-hub/assets/radar-live-v1.js', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');

const createHarness = ({ hash = '#inicio', visible = true, online = true, now = 100_000 } = {}) => {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const timers = new Map();
  const calls = { collect: [], invalidate: 0 };
  let timerSequence = 0;
  let currentNow = now;

  const addListener = (registry, name, handler) => {
    const handlers = registry.get(name) || [];
    handlers.push(handler);
    registry.set(name, handlers);
  };

  const dispatch = async (registry, name) => {
    for (const handler of registry.get(name) || []) handler({ type: name });
    await Promise.resolve();
    await Promise.resolve();
  };

  const window = {
    PMHRadarData: {
      invalidate() { calls.invalidate += 1; },
      async collect(options) { calls.collect.push(options); return { items: [] }; },
    },
    addEventListener(name, handler) { addListener(windowListeners, name, handler); },
    setTimeout(fn, delay) {
      const id = ++timerSequence;
      timers.set(id, { fn, delay });
      return id;
    },
  };

  const document = {
    visibilityState: visible ? 'visible' : 'hidden',
    addEventListener(name, handler) { addListener(documentListeners, name, handler); },
  };

  const location = { hash };
  const navigator = { onLine: online };

  const context = vm.createContext({
    window,
    document,
    location,
    navigator,
    Date: class extends Date { static now() { return currentNow; } },
    clearTimeout(id) { timers.delete(id); },
    Set,
    String,
    Promise,
  });

  vm.runInContext(source, context, { filename: 'radar-live-v1.js' });

  const runNextTimer = async () => {
    const entry = timers.entries().next().value;
    assert.ok(entry, 'esperava um timer agendado');
    const [id, timer] = entry;
    timers.delete(id);
    timer.fn();
    await Promise.resolve();
    await Promise.resolve();
    return timer.delay;
  };

  return {
    calls,
    timers,
    location,
    document,
    navigator,
    setNow(value) { currentNow = value; },
    async bootstrap() { return runNextTimer(); },
    async dispatchWindow(name) { return dispatch(windowListeners, name); },
    async dispatchDocument(name) { return dispatch(documentListeners, name); },
  };
};

for (const hash of ['#inicio', '#hoje', '#radar', '#planet']) {
  const app = createHarness({ hash });
  assert.equal(await app.bootstrap(), 700, `${hash} deve iniciar pelo delay de bootstrap`);
  assert.equal(app.calls.collect.length, 1, `${hash} deve permitir coleta completa`);
  assert.equal(app.calls.invalidate, 1, `${hash} deve invalidar antes da coleta`);
  assert.equal(app.calls.collect[0]?.force, true, `${hash} deve preservar collect({ force: true })`);
}

for (const hash of ['#marketing', '#chamados', '#inauguracoes', '#demandas', '#conteudos', '#expansao', '#aquisicao', '#5-estrelas', '#calendario']) {
  const app = createHarness({ hash });
  await app.bootstrap();
  assert.equal(app.calls.collect.length, 0, `${hash} não deve disparar refresh global`);
  assert.equal(app.calls.invalidate, 0, `${hash} não deve invalidar o Radar global`);
  assert.equal(app.timers.size, 0, `${hash} deve ficar sem timer periódico global`);
}

{
  const app = createHarness({ hash: '#marketing' });
  await app.bootstrap();
  app.location.hash = '#planet';
  await app.dispatchWindow('hashchange');
  assert.equal(app.calls.collect.length, 1, 'entrar em Planet deve reativar o refresh global');
  assert.ok(app.timers.size > 0, 'Planet deve reagendar o refresh periódico');

  app.location.hash = '#chamados';
  await app.dispatchWindow('hashchange');
  assert.equal(app.calls.collect.length, 1, 'sair de superfície global não deve coletar novamente');
  assert.equal(app.timers.size, 0, 'sair de superfície global deve pausar o timer');

  app.setNow(141_000);
  app.location.hash = '#radar';
  await app.dispatchWindow('hashchange');
  assert.equal(app.calls.collect.length, 2, 'voltar a superfície global deve reativar o refresh');
}

{
  const app = createHarness({ hash: '#planet', visible: false });
  await app.bootstrap();
  assert.equal(app.calls.collect.length, 0, 'superfície global oculta não deve atualizar');
  app.document.visibilityState = 'visible';
  await app.dispatchDocument('visibilitychange');
  assert.equal(app.calls.collect.length, 1, 'visibilitychange para visível deve reativar');
}

{
  const app = createHarness({ hash: '#radar', online: false });
  await app.bootstrap();
  assert.equal(app.calls.collect.length, 0, 'offline deve bloquear refresh global');
  app.navigator.onLine = true;
  await app.dispatchWindow('online');
  assert.equal(app.calls.collect.length, 1, 'online deve reativar refresh em superfície global');
}

{
  const app = createHarness({ hash: '#inicio' });
  await app.bootstrap();
  app.setNow(141_000);
  await app.dispatchWindow('focus');
  assert.equal(app.calls.collect.length, 2, 'focus continua reavaliando refresh quando autorizado');
}

assert.match(source, /window\.addEventListener\('hashchange', wake\)/, 'mudança de rota deve reavaliar o escopo');
assert.match(source, /radar\(\)\.invalidate\(\)/, 'invalidate deve permanecer no refresh autorizado');
assert.match(source, /radar\(\)\.collect\(\{ force: true \}\)/, 'coleta completa forçada deve permanecer nas superfícies globais');

console.log('Radar Live: refresh completo restrito a Início/Hoje, Radar e Planet, com reentrada por rota preservada.');
