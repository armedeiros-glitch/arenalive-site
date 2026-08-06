import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('planet-hub/assets/finance-visual-v1.css', 'utf8');
const system = fs.readFileSync('planet-hub/assets/andre-os-visual-system-v1.css', 'utf8');

assert.match(system, /finance-visual-v1\.css/);
assert.match(css, /var\(--os-surface\)/);
assert.match(css, /var\(--os-border\)/);
assert.match(css, /\.pmh-finance-kpis/);
assert.match(css, /\.pmh-finance-panel/);
assert.match(css, /\.pmh-payment-row/);
assert.match(css, /\.pmh-finance-dialog/);
assert.doesNotMatch(css, /!important/);
assert.doesNotMatch(css, /MutationObserver/);
assert.doesNotMatch(css, /@media\s+print/);
assert.doesNotMatch(css, /payment-document|payment-print|print-clean/);

console.log('visual-system-finance-v1: ok');
