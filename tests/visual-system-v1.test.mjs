import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('planet-hub/assets/andre-os-visual-system-v1.css', 'utf8');

const foundationAt = index.indexOf('andre-os-foundation-v1.css');
const visualSystemAt = index.indexOf('andre-os-visual-system-v1.css');
const dashboardAt = index.indexOf('andre-os-dashboard-v1.css');

assert.ok(foundationAt >= 0, 'foundation stylesheet must remain loaded');
assert.ok(visualSystemAt > foundationAt, 'visual system must load after foundation');
assert.ok(dashboardAt > visualSystemAt, 'feature styles must load after visual system tokens');

for (const token of [
  '--os-page',
  '--os-surface',
  '--os-text',
  '--os-border',
  '--os-accent',
  '--os-radius-md',
  '--os-shadow-md'
]) {
  assert.ok(css.includes(token), `missing official token ${token}`);
}

for (const contract of [
  '.os-surface',
  '.os-surface-raised',
  '.os-button',
  '.os-button-primary',
  '.os-field',
  '.os-chip',
  '.os-alert'
]) {
  assert.ok(css.includes(contract), `missing shared contract ${contract}`);
}

assert.match(css, /@media \(max-width: 820px\) and \(prefers-color-scheme: dark\)/,
  'dark tokens must remain mobile-only until desktop migration is complete');
assert.ok(!index.includes('andre-os-desktop-radar-dark-v1.css'),
  'temporary desktop dark radar layer must not be loaded');

console.log('visual-system-v1 contract: OK');
