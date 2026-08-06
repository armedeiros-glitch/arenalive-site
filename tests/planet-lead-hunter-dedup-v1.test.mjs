import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { createCandidate } from '../functions/_lib/planet-lead-candidates.js';
import { upsertLead } from '../functions/_lib/planet-leads.js';

class KV { constructor() { this.values = new Map(); } async get(key, options) { const value = this.values.get(key); return options?.type === 'json' && value ? JSON.parse(value) : value ?? null; } async put(key, value) { this.values.set(key, value); } }
const store = new KV();
const base = await createCandidate(store, { name: 'Base', phone: '47999990002', email: 'base@exemplo.com', source: 'lista', sourceRecordId: 'A', city: 'Joinville' });
assert.equal(base.duplicate, false);
assert.equal((await createCandidate(store, { name: 'Mesmo registro', phone: '47911111111', source: 'lista', sourceRecordId: 'A' })).duplicateType, 'candidate');
assert.equal((await createCandidate(store, { name: 'Mesmo telefone', phone: '(47) 99999-0002', source: 'outra' })).duplicateType, 'candidate');
assert.equal((await createCandidate(store, { name: 'Mesmo e-mail', email: 'BASE@EXEMPLO.COM', source: 'outra2' })).duplicateType, 'candidate');
const noContact = await createCandidate(store, { company: 'Empresa Igual', city: 'Blumenau', source: 'lista', sourceRecordId: 'B' });
assert.equal(noContact.duplicate, false);
assert.equal((await createCandidate(store, { company: 'empresa igual', city: 'blumenau', source: 'outra' })).duplicateType, 'candidate');
await upsertLead(store, { source: 'manual', name: 'Já no funil', email: 'funil@exemplo.com' });
const leadDuplicate = await createCandidate(store, { name: 'Lead duplicado', email: 'FUNIL@EXEMPLO.COM', source: 'lista', sourceRecordId: 'C' });
assert.equal(leadDuplicate.duplicateType, 'lead');
assert.ok(leadDuplicate.leadId);
console.log('Deduplicação de candidatos e funil validada.');
