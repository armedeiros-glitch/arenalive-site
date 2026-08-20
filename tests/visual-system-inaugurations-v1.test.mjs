import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const operations = await readFile(new URL('../planet-hub/assets/andre-os-operations-v1.css', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../planet-hub/assets/inauguration-workspace-v2.css', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('inaugurações consome os tokens oficiais nas duas superfícies', () => {
  for (const css of [operations, workspace]) {
    assert.match(css, /var\(--os-surface\)/);
    assert.match(css, /var\(--os-border\)/);
    assert.match(css, /var\(--os-text/);
  }
});

test('o núcleo de inaugurações não mantém branco fixo', () => {
  const inaugurationBlock = operations.split('/* Calendar and library */')[0];
  assert.doesNotMatch(inaugurationBlock, /background:\s*#fff(?:fff)?\b/i);
  assert.doesNotMatch(inaugurationBlock, /#fafafe\b/i);
});

test('os estilos atualizados recebem nova versão de cache', () => {
  assert.match(index, /andre-os-operations-v1\.css\?v=20260806-2/);
  assert.match(index, /inauguration-workspace-v2\.css\?v=20260808-2/);
});

test('a migração não adiciona observação de DOM', () => {
  assert.doesNotMatch(operations + workspace, /MutationObserver/);
});
