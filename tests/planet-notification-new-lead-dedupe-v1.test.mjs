import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  normalizeNotification,
  summarizeNotifications,
} = await import('../functions/_lib/planet-notifications.js');

const newLead = (id, createdAt, summary = 'Ricardo Vieira · Campo Grande/MS · lp-franquias') => normalizeNotification({
  id,
  type: 'lead.new',
  priority: 'high',
  title: 'Novo lead de franquia',
  summary,
  leadId: `lead-${id}`,
  leadName: 'Ricardo Vieira',
  createdAt,
  updatedAt: createdAt,
});

const raw = [
  newLead('dup-3', '2026-08-28T12:11:28.000Z'),
  newLead('dup-2', '2026-08-28T12:11:07.000Z'),
  newLead('dup-1', '2026-08-28T12:11:03.000Z'),
  newLead('legit-later', '2026-08-28T12:14:30.000Z'),
  newLead('different-summary', '2026-08-28T12:11:20.000Z', 'Ricardo Vieira · Campo Grande/MS · indicação'),
];

const summarized = summarizeNotifications({
  revision: 'test',
  updatedAt: raw[0].updatedAt,
  data: raw,
});

assert.equal(raw.length, 5, 'resumo não deve apagar nem mutar o documento bruto');
assert.equal(summarized.data.length, 3,
  'três notificações iguais em até 2 minutos devem virar uma; evento posterior e resumo diferente permanecem');
assert.equal(summarized.data.some((item) => item.id === 'dup-3'), true,
  'como a entrada chega ordenada do mais recente, deve permanecer a ocorrência mais nova da rajada');
assert.equal(summarized.data.some((item) => item.id === 'dup-2'), false);
assert.equal(summarized.data.some((item) => item.id === 'dup-1'), false);
assert.equal(summarized.data.some((item) => item.id === 'legit-later'), true,
  'mesma pessoa fora da janela curta não deve ser escondida');
assert.equal(summarized.data.some((item) => item.id === 'different-summary'), true,
  'mudança material no resumo não deve ser agrupada só porque o nome coincide');
assert.equal(summarized.unread, 3);

console.log('Planet notificações: rajadas antigas de lead.new são colapsadas só na leitura');
