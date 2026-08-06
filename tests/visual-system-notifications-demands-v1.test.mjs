import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const demandCss = await readFile(new URL('../planet-hub/assets/internal-demands-v1.css', import.meta.url), 'utf8');
const feedbackCss = await readFile(new URL('../planet-hub/assets/andre-os-feedback-v1.css', import.meta.url), 'utf8');

test('demandas internas consomem tokens oficiais', () => {
  for (const token of ['--os-surface', '--os-text', '--os-border', '--os-accent']) {
    assert.match(demandCss, new RegExp(token));
  }
  assert.doesNotMatch(demandCss, /MutationObserver/);
  assert.doesNotMatch(demandCss, /!important/);
  assert.doesNotMatch(demandCss, /background:\s*#fff(?:fff)?\b/i);
});

test('avisos globais usam tokens sem alterar o ciclo de vida', () => {
  assert.match(feedbackCss, /--os-danger/);
  assert.match(feedbackCss, /aos-feedback-toast-lifecycle/);
  assert.match(feedbackCss, /prefers-reduced-motion/);
  assert.doesNotMatch(feedbackCss, /!important/);
  assert.doesNotMatch(feedbackCss, /MutationObserver/);
});
