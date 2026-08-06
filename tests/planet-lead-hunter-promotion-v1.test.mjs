import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { createCandidate, promoteCandidate, updateCandidate } from '../functions/_lib/planet-lead-candidates.js';
import { readLeadDocument, upsertLead } from '../functions/_lib/planet-leads.js';

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


const linkedStore = new KV();
const linkedCandidate = await createCandidate(linkedStore, {
  name: 'Lead concorrente',
  phone: '47999990009',
  source: 'lista_autorizada',
  sourceRecordId: 'late-1',
  sourceName: 'Lista autorizada',
});
const officialLead = await upsertLead(linkedStore, {
  source: 'rd_station',
  externalId: 'rd-original-9',
  name: 'Lead oficial',
  phone: '47999990009',
  origin: 'Landing page',
  conversion: 'Quero ser franqueado',
  assignedTo: 'Expansão',
  status: 'contacted',
  notes: 'Contato já em andamento.',
});
await updateCandidate(linkedStore, linkedCandidate.candidate.id, {
  reviewStatus: 'approved',
  reviewedBy: 'André',
});
const linkedPromotion = await promoteCandidate(linkedStore, linkedCandidate.candidate.id);
const linkedLeads = await readLeadDocument(linkedStore);
assert.equal(linkedPromotion.duplicate, true, 'promoção deve vincular ao lead que surgiu depois');
assert.equal(linkedLeads.data.length, 1, 'promoção não pode criar funil paralelo');
assert.equal(linkedLeads.data[0].id, officialLead.lead.id);
assert.equal(linkedLeads.data[0].source, 'rd_station');
assert.equal(linkedLeads.data[0].externalId, 'rd-original-9');
assert.equal(linkedLeads.data[0].origin, 'Landing page');
assert.equal(linkedLeads.data[0].conversion, 'Quero ser franqueado');
assert.equal(linkedLeads.data[0].status, 'contacted');
assert.equal(linkedLeads.data[0].notes, 'Contato já em andamento.');
assert.match(linkedLeads.data[0].history[0].title, /Caça Lead/);

console.log('Promoção explícita, idempotente e sem sobrescrever o funil validada.');
