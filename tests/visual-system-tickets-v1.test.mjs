import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('planet-hub/assets/ticket-command-v1.css', 'utf8');

for (const token of [
  '--os-surface',
  '--os-surface-subtle',
  '--os-text-strong',
  '--os-text-muted',
  '--os-border',
  '--os-danger-soft',
  '--os-warning-soft',
  '--os-info-soft',
  '--os-accent-soft'
]) {
  assert.ok(css.includes(`var(${token})`), `Chamados deve consumir ${token}`);
}

assert.equal(/background\s*:\s*(?:#fff(?:fff)?|white)\b/i.test(css), false, 'Chamados não deve manter fundo branco fixo');
assert.equal(css.includes('MutationObserver'), false, 'CSS de Chamados não deve depender de observação do DOM');
assert.equal(css.includes('!important'), false, 'Migração de Chamados não deve criar guerra de especificidade');
assert.ok(css.includes('@media (max-width: 820px)'), 'Responsividade mobile deve ser preservada');
assert.ok(css.includes('.pmh-command-ticket-facts'), 'Fatos do chamado devem continuar estilizados');

console.log('visual-system-tickets-v1: ok');
