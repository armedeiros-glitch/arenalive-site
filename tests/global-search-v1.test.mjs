import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('planet-hub/assets/global-search-v1.js', 'utf8');
const css = fs.readFileSync('planet-hub/assets/global-search-v1.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.ok(script.includes("'/api/sults/chamados?start=0&limit=100'"), 'must search tickets');
assert.ok(script.includes("'/api/sults/implantacoes?start=0&limit=100'"), 'must search projects');
assert.ok(script.includes("'/api/hub/inauguracoes'"), 'must search tracked inaugurations');
assert.ok(script.includes('ticketResult'), 'must normalize ticket results');
assert.ok(script.includes('projectResult'), 'must normalize project results');
assert.ok(script.includes('inaugurationResult'), 'must normalize inauguration results');
assert.ok(script.includes("event.key === 'ArrowDown'"), 'must support keyboard navigation');
assert.ok(script.includes("event.key === 'Enter'"), 'must open the selected result');
assert.ok(!script.includes('MutationObserver'), 'must not use a global observer');
assert.ok(!script.includes('andre-os-mobile-shell'), 'must not alter the mobile shell');
assert.ok(css.includes('@media (max-width: 820px)'), 'must position results safely on mobile');
assert.ok(index.includes('global-search-v1.css?v=20260806-1'), 'official entry must load global search CSS');
assert.ok(index.includes('global-search-v1.js?v=20260806-1'), 'official entry must load global search JS');
assert.ok(index.includes('mobile-priority-carousel-v1.css?v=20260805-3'), 'approved mobile priorities must remain loaded');
assert.ok(index.includes('andre-os-mobile-shell-v2.js?v=20260807-11'), 'approved mobile shell must remain loaded');

console.log('global search checks passed');
