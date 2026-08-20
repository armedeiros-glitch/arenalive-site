const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const js = fs.readFileSync('planet-hub/assets/inauguration-project-close-v1.js', 'utf8');

assert(html.includes('inauguration-project-close-v1.css'), 'CSS de fechamento deve estar carregado');
assert(html.includes('inauguration-project-close-v1.js'), 'JS de fechamento deve estar carregado');
assert(js.includes('data.inaugurationProjectClose') || js.includes('inaugurationProjectClose'), 'controle de fechamento deve existir');
assert(js.includes("event.key !== 'Escape'"), 'Escape deve fechar o projeto');
console.log('inauguration-project-close-v1 ok');
