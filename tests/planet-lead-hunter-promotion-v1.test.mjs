import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { createCandidate, promoteCandidate, updateCandidate } from '../functions/_lib/planet-lead-candidates.js';
import { readLeadDocument } from '../functions/_lib/planet-leads.js';

class KV { constructor() { this.values = new Map(); } async get(key, options) { const value = this.values.get(key); return options?.type === 'json' && value ? JSON.parse(value) : value ?? null; } async put(key, value) { this.values.set(key, value); } }
const store = new KV();
const created = await createCandidate(store, { name: 'João', company: 'Mercado João', phone: '47999990001', city: 'Joinville', state: 'SC', source: 'manual', sourceRecordId: '1', sourceName: 'Lista teste', franchiseModel: 'Loja' });
assert.equal((await readLeadDocument(store)).data.length, 0, 'candidato não entra automaticamente no funil');
await assert.rejects(() => promoteCandidate(store, created.candidate.id), /aprovação humana explícita/i);
await updateCandidate(store, created.candidate.id, { reviewStatus: 'approved', reviewedBy: 'André' });
const first = await promoteCandidate(store, created.candidate.id);
const second = await promoteCandidate(store, created.candidate.id);
assert.equal(first.lead.source, 'caca_lead');
assert.equal(first.lead.externalId, created.candidate.id);
assert.equal(second.leadId, first.leadId);
assert.equal(second.idempotent, true);
const leads = await readLeadDocument(store);
assert.equal(leads.data.length, 1);
assert.match(leads.data[0].history[0].title, /Caça Lead/);

const rejected = await createCandidate(store, { name: 'Rejeitado', email: 'r@exemplo.com', source: 'manual', sourceRecordId: '2' });
await updateCandidate(store, rejected.candidate.id, { reviewStatus: 'rejected', discardReason: 'Sem perfil' });
await assert.rejects(() => promoteCandidate(store, rejected.candidate.id), /rejeitado/i);
const noContact = await createCandidate(store, { name: 'Sem contato', company: 'XPTO', source: 'manual', sourceRecordId: '3' });
await updateCandidate(store, noContact.candidate.id, { reviewStatus: 'approved' });
await assert.rejects(() => promoteCandidate(store, noContact.candidate.id), /telefone ou e-mail/i);
console.log('Promoção explícita e idempotente validada.');
