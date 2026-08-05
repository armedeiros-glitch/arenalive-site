import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath = new URL('../planet-hub/assets/andre-os-runtime-core-v1.js', import.meta.url);
const contextPath = new URL('../planet-hub/assets/andre-os-context-engine-v1.js', import.meta.url);
const adapterPath = new URL('../planet-hub/assets/thinking-assistant-context-adapter-v1.js', import.meta.url);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const contextSource = fs.readFileSync(contextPath, 'utf8');
const adapterSource = fs.readFileSync(adapterPath, 'utf8');

const windowTarget = new EventTarget();
const documentTarget = new EventTarget();
const location = { hostname: 'localhost', search: '', pathname: '/', hash: '#inicio' };
const context = {
  console,
  EventTarget,
  CustomEvent,
  URLSearchParams,
  structuredClone,
  queueMicrotask,
  setTimeout,
  clearTimeout,
  Symbol,
  Date,
  Intl,
  Map,
  Set,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  TypeError,
  Error,
  JSON,
  Math,
  window: windowTarget,
  document: documentTarget,
  location,
};

windowTarget.window = windowTarget;
windowTarget.document = documentTarget;
windowTarget.location = location;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(runtimeSource, context, { filename: runtimePath.pathname });
vm.runInContext(contextSource, context, { filename: contextPath.pathname });

const { AndreOS } = windowTarget;
assert.equal(AndreOS.context.version, '1.0.0');
assert.equal(AndreOS.context.schemaVersion, 1);
assert.equal(typeof AndreOS.context.get, 'function');
assert.equal(typeof AndreOS.context.update, 'function');
assert.equal(typeof AndreOS.context.subscribe, 'function');
assert.equal(typeof AndreOS.context.registerProvider, 'function');
assert.equal(typeof AndreOS.context.explain, 'function');

AndreOS.events.emit(AndreOS.events.names.system.authenticated, {
  configured: true,
  authenticated: true,
}, { retain: true });

AndreOS.events.emit(AndreOS.events.names.navigation.viewChanged, {
  view: 'chamados',
  viewId: 'chamados:1',
}, { retain: true });

AndreOS.events.emit(AndreOS.events.names.radar.updated, {
  items: [
    {
      id: 'ticket-waiting',
      action: 'chamados',
      title: 'Aguardando retorno',
      operationalState: 'waiting_info',
      priority: 0,
    },
    {
      id: 'ticket-actionable',
      action: 'chamados',
      title: 'Responder solicitação',
      operationalState: 'actionable',
      priority: 1,
      nextAction: 'Responder o chamado.',
    },
  ],
  errors: ['SULTS'],
  loadedAt: '2026-08-05T04:00:00.000Z',
}, { retain: true });

let snapshot = AndreOS.context.update('test.radar');
assert.equal(snapshot.authentication.authenticated, true);
assert.equal(snapshot.navigation.view, 'chamados');
assert.equal(snapshot.navigation.pageId, 'planet_marketing.chamados');
assert.equal(snapshot.focus.item.id, 'ticket-actionable');
assert.equal(snapshot.focus.origin, 'radar-order');
assert.equal(snapshot.focus.nextAction, 'Responder o chamado.');
assert.equal(snapshot.sources.sults.status, 'unavailable');
assert.equal(snapshot.sources.radar.status, 'degraded');
assert.equal(AndreOS.context.explain('focus').sources[0], 'radar');
assert.equal(AndreOS.state.get('context.current.focus.item.id'), 'ticket-actionable');

let subscriptions = 0;
const unsubscribe = AndreOS.context.subscribe(() => { subscriptions += 1; }, { immediate: false });

AndreOS.events.emit(AndreOS.events.names.focus.changed, {
  item: {
    id: 'ticket-waiting',
    type: 'chamados',
    title: 'Aguardando retorno',
    operationalState: 'waiting_info',
    blockerReason: 'Depende do solicitante.',
  },
}, { retain: true });

snapshot = AndreOS.context.update('test.focus');
assert.equal(snapshot.focus.item.id, 'ticket-waiting');
assert.equal(snapshot.focus.origin, 'explicit');
assert.equal(snapshot.focus.attentionLevel, 'waiting');
assert.equal(snapshot.explanations.focus.sources[0], 'focus');
assert.ok(subscriptions >= 1);
unsubscribe();

const removeProvider = AndreOS.context.registerProvider('testProvider', () => ({
  value: { enabled: true },
  evidence: [{ type: 'fact', message: 'Provider de teste.' }],
}), { priority: 5 });

snapshot = AndreOS.context.update('test.provider');
assert.equal(snapshot.providers.testProvider.status, 'ready');
assert.equal(AndreOS.context.providers().includes('testProvider'), true);
removeProvider();
AndreOS.context.update('test.provider-removed');
assert.equal(AndreOS.context.providers().includes('testProvider'), false);

assert.ok(AndreOS.events.latest(AndreOS.context.events.updated));
assert.ok(AndreOS.events.latest(AndreOS.context.events.focusChanged));
assert.ok(AndreOS.events.latest(AndreOS.events.names.assistant.contextUpdated));

let registeredProvider = null;
let refreshCount = 0;
windowTarget.ThinkingAssistant = {
  version: '1.0.0',
  registerContextProvider(name, provider, priority) {
    registeredProvider = { name, provider, priority };
    return () => {};
  },
  refresh() { refreshCount += 1; },
};
vm.runInContext(adapterSource, context, { filename: adapterPath.pathname });
assert.equal(registeredProvider.name, 'andreOSContext');
assert.equal(registeredProvider.priority, 1000);
assert.equal(registeredProvider.provider().engineVersion, '1.0.0');

const requestPayload = {
  request_id: 'request-1',
  context: {
    captured_at: '2026-08-05T04:10:00.000Z',
    selected_item: {
      id: 'ticket-actionable',
      type: 'chamados',
      title: 'Responder solicitação',
      operational_state: 'actionable',
      next_action: 'Responder o chamado.',
    },
  },
};
windowTarget.dispatchEvent(new CustomEvent('andre-os:thinking-request', {
  detail: { payload: requestPayload },
}));
assert.equal(requestPayload.context.schema_version, 2);
assert.equal(requestPayload.context.runtime_context.engineVersion, '1.0.0');
assert.equal(requestPayload.context.selected_item.id, 'ticket-actionable');
assert.equal(requestPayload.context.decision_context.next_action, 'Responder o chamado.');
assert.ok(AndreOS.events.history({ filter: 'assistant.thinkingStarted' }).length >= 1);
assert.ok(refreshCount >= 0);

console.log('AndreOS Context Engine v1: tests passed');
