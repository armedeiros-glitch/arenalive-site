import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('planet-hub/assets/finance-visual-v1.css', 'utf8');
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const system = fs.readFileSync('planet-hub/assets/andre-os-visual-system-v1.css', 'utf8');

assert.match(system, /finance-visual-v1\.css/);
assert.match(css, /var\(--os-surface\)/);
assert.match(css, /var\(--os-border\)/);
assert.match(css, /\.pmh-finance-kpis/);
assert.match(css, /\.pmh-finance-panel/);
assert.match(css, /\.pmh-payment-row/);
assert.match(css, /\.pmh-finance-dialog/);
assert.doesNotMatch(cssWithoutComments, /!important/);
assert.doesNotMatch(cssWithoutComments, /MutationObserver/);
assert.doesNotMatch(cssWithoutComments, /@media\s+print/);
assert.doesNotMatch(cssWithoutComments, /payment-document|payment-print|print-clean/);

console.log('visual-system-finance-v1: ok');
