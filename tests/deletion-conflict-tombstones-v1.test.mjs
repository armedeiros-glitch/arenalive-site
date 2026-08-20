import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const demands = fs.readFileSync(new URL('planet-hub/assets/internal-demands-v1.js', root), 'utf8');
const contents = fs.readFileSync(new URL('planet-hub/assets/content-library-v1.js', root), 'utf8');

for (const [name, source] of [['Demandas', demands], ['Central Planet', contents]]) {
  assert.match(source, /deletedIds:\s*new Set\(\)/, `${name} deve manter tombstones durante a sincronização.`);
  assert.match(source, /deletedIds\.add\(item\.id\)/, `${name} deve registrar o ID antes de excluir localmente.`);
  assert.match(source, /deletedIds\.clear\(\)/, `${name} só deve limpar tombstones após uma gravação confirmada.`);
  assert.match(source, /error\.status === 409/, `${name} deve resolver conflito de revisão.`);
  assert.match(source, /deletedIds\.has/, `${name} deve ignorar IDs excluídos durante o merge.`);
}

assert.match(demands, /if \(state\.deletedIds\.has\(item\.id\)\) return;/);
assert.match(contents, /if \(!id \|\| state\.deletedIds\.has\(id\)\) return;/);
assert.match(contents, /const save = async \(rerender = true, retried = false\)/);
assert.match(contents, /if \(!retried && error\.status === 409/);

const mergeWithTombstones = (remote, local, deletedIds) => {
  const map = new Map();
  [...remote, ...local].forEach((item) => {
    if (!item?.id || deletedIds.has(item.id)) return;
    const current = map.get(item.id);
    if (!current || Date.parse(item.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) map.set(item.id, item);
  });
  return [...map.values()];
};

const deletedIds = new Set(['gone']);
const merged = mergeWithTombstones(
  [
    { id: 'gone', updatedAt: '2026-08-11T19:00:00.000Z' },
    { id: 'remote-only', updatedAt: '2026-08-11T19:01:00.000Z' },
  ],
  [{ id: 'local-only', updatedAt: '2026-08-11T19:02:00.000Z' }],
  deletedIds,
);

assert.deepEqual(merged.map((item) => item.id).sort(), ['local-only', 'remote-only']);
assert.equal(merged.some((item) => item.id === 'gone'), false, 'O item excluído não pode ressuscitar após um 409.');

console.log('Deletion conflict tombstones: tests passed');
