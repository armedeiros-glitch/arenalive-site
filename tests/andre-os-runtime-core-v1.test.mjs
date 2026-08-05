import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const runtimePath = new URL('../planet-hub/assets/andre-os-runtime-core-v1.js', import.meta.url);
const source = fs.readFileSync(runtimePath, 'utf8');

const windowTarget = new EventTarget();
const documentTarget = new EventTarget();
const location = { hostname: 'localhost', search: '' };
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
vm.runInContext(source, context, { filename: runtimePath.pathname });

const { AndreOS } = windowTarget;

assert.equal(AndreOS.runtime.version, '1.0.0');
assert.equal(AndreOS.events.latest('system.ready').detail.version, '1.0.0');

let received = null;
const unsubscribe = AndreOS.events.on('focus.changed', (detail) => {
  received = detail;
});
AndreOS.events.emit('focus.changed', { itemId: 'ticket-1' });
assert.equal(received.itemId, 'ticket-1');
unsubscribe();
received = null;
AndreOS.events.emit('focus.changed', { itemId: 'ticket-2' });
assert.equal(received, null);

let onceCount = 0;
AndreOS.events.once('focus.completed', () => {
  onceCount += 1;
});
AndreOS.events.emit('focus.completed', {});
AndreOS.events.emit('focus.completed', {});
assert.equal(onceCount, 1);

let legacyView = null;
windowTarget.addEventListener('pmh:view-rendered', (event) => {
  legacyView = event.detail;
});
AndreOS.events.emit('navigation.viewChanged', {
  view: 'inicio',
  viewId: 'inicio:1',
}, { retain: true });
assert.equal(legacyView.viewId, 'inicio:1');

let canonicalRadar = null;
AndreOS.events.on('radar.updated', (detail) => {
  canonicalRadar = detail;
});
windowTarget.dispatchEvent(new CustomEvent('pmh:radar-data', {
  detail: { items: [{ id: 1 }], loadedAt: 'snapshot-1' },
}));
assert.equal(canonicalRadar.items[0].id, 1);

let replayCount = 0;
windowTarget.addEventListener('pmh:view-rendered', (event) => {
  if (event.detail.replayed) replayCount += 1;
});
const replayDetail = {
  view: 'inicio',
  viewId: 'inicio:1',
  replayed: true,
};
AndreOS.events.replay('navigation.viewChanged', {
  detail: replayDetail,
  internal: false,
  dedupeKey: replayDetail.viewId,
});
AndreOS.events.replay('navigation.viewChanged', {
  detail: replayDetail,
  internal: false,
  dedupeKey: replayDetail.viewId,
});
assert.equal(replayCount, 1);

AndreOS.state.registerSlice('navigation', { view: 'inicio' });
assert.equal(AndreOS.state.get('navigation.view'), 'inicio');
let change = null;
AndreOS.state.subscribe('navigation', (nextChange) => {
  change = nextChange;
});
AndreOS.state.set('navigation.view', 'chamados');
assert.equal(AndreOS.state.get('navigation.view'), 'chamados');
assert.equal(change.path, 'navigation.view');

console.log('AndreOS Runtime v1: tests passed');
