import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const details = await readFile(new URL('../planet-hub/assets/ticket-details-v1.js', import.meta.url), 'utf8');
const ignored = await readFile(new URL('../planet-hub/assets/ignored-tickets-v1.js', import.meta.url), 'utf8');
const fallbackUrl = new URL('../planet-hub/assets/sults-open-fallback-v1.js', import.meta.url);

assert.equal(
  index.includes('/planet-hub/assets/sults-open-fallback-v1.js'),
  false,
  'sults-open-fallback não deve mais ser carregado pelo runtime',
);
await access(fallbackUrl, constants.F_OK);

assert.ok(
  details.includes("const SULTS_BASE = 'https://planetchocolate.sults.com.br/chamados/interacoes'"),
  'ticket-details mantém a base oficial do chamado no SULTS',
);
assert.ok(
  details.includes('const sultsUrl = ticket.sultsUrl || `${SULTS_BASE}/${ticket.id}`'),
  'ticket-details continua resolvendo a URL do chamado',
);
assert.ok(details.includes('>Abrir no SULTS ↗</a>'), 'texto oficial deve permanecer Abrir no SULTS');
assert.ok(details.includes('target="_blank"'), 'link do SULTS deve abrir em nova aba');
assert.ok(details.includes('rel="noopener noreferrer"'), 'link externo deve preservar proteção noopener/noreferrer');
assert.equal(details.includes('Copiar link'), false, 'ticket-details não deve reinterpretar a ação como copiar link');

const scriptSources = [...index.matchAll(/<script[^>]+src="([^"]+\.js)(?:\?[^\"]*)?"/g)]
  .map((match) => match[1])
  .filter((src) => src.startsWith('/planet-hub/assets/'));

for (const src of scriptSources) {
  const source = await readFile(new URL(`..${src}`, import.meta.url), 'utf8');
  assert.equal(
    source.includes('data-sults-copy-link-ready'),
    false,
    `${src} não deve transformar Abrir no SULTS em Copiar link`,
  );
}

assert.ok(details.includes("drawer.className = 'pmh-ticket-drawer'"), 'drawer continua sendo criado pelo ticket-details');
assert.ok(details.includes('fetch(`${DETAIL_API}/${encodeURIComponent(id)}`'), 'drawer continua buscando /api/sults/chamados/<id>');
assert.ok(details.includes("event.target.closest('[data-ticket-close]')"), 'fechamento do drawer continua ativo');
assert.ok(details.includes("event.key === 'Escape' && drawer"), 'Escape continua fechando o drawer');

assert.ok(ignored.includes("document.querySelectorAll('.pmh-ticket-drawer-panel')"), 'ignored-tickets continua decorando o drawer');
assert.ok(ignored.includes("button.textContent = 'Excluir do Hub'"), 'Excluir do Hub continua coexistindo no drawer');
assert.ok(index.includes('/planet-hub/assets/ignored-tickets-v1.js'), 'ignored-tickets continua ativo no runtime');

const cssChangesGuard = scriptSources.every((src) => !src.endsWith('.css'));
assert.equal(cssChangesGuard, true, 'este contrato não introduz assets CSS');

console.log('Chamados: ticket-details é owner único de Abrir no SULTS; fallback saiu do runtime e Excluir do Hub permanece coexistindo.');
