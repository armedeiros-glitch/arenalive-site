import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('planet-hub/assets/andre-os-dark-theme-v1.css', 'utf8');
const script = fs.readFileSync('planet-hub/assets/andre-os-theme-sync-v1.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.ok(css.includes('@media (prefers-color-scheme: dark)'), 'dark theme must follow the device setting');
assert.ok(css.includes('--aos-page: #111015'), 'dark page token must exist');
assert.ok(css.includes('--aos-surface: #1b1921'), 'dark surface token must exist');
assert.ok(css.includes('.pmh-global-search-results'), 'global search must support dark theme');
assert.ok(css.includes('html.aos-mobile .pmh-sidebar'), 'mobile sidebar must support dark theme');
assert.ok(css.includes('@media print'), 'print output must remain light');
assert.ok(!css.includes('filter: invert('), 'theme must not use blanket color inversion');
assert.ok(!script.includes('MutationObserver'), 'theme sync must not observe the DOM');
assert.ok(script.includes("matchMedia('(prefers-color-scheme: dark)')"), 'browser chrome must follow the device theme');
assert.ok(index.includes('andre-os-dark-theme-v1.css?v=20260806-1'), 'official entry must load the theme CSS');
assert.ok(index.includes('andre-os-theme-sync-v1.js?v=20260806-1'), 'official entry must load theme sync');
assert.ok(index.indexOf('andre-os-dark-theme-v1.css') > index.indexOf('andre-os-feedback-v1.css'), 'theme CSS must load last');

console.log('automatic dark theme checks passed');
