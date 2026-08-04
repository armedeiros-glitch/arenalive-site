import { isAccessConfigured } from '../../_lib/hub-auth.js';
import { decryptText, encryptText, encryptionConfigured } from '../../_lib/hub-crypto.js';

const STORAGE_KEY = 'planet-hub:financeiro:v1';
const MAX_SUPPLIERS = 300;
const MAX_PAYMENTS = 2000;
const MAX_BODY_BYTES = 1_500_000;
const STATUSES = ['draft', 'docs_pending', 'awaiting_approval', 'sent_finance', 'paid', 'rejected'];
const headers = { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const cleanMoney = (value) => { const parsed = Number(value); return !Number.isFinite(parsed) || parsed < 0 ? 0 : Math.min(10_000_000, Math.round(parsed * 100) / 100); };
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const digits = (value) => String(value || '').replace(/\D/g, '');
const getStore = (env) => env.PLANET_HUB_DATA;

const normalizeSupplierPlain = (item = {}) => ({
  id: cleanText(item.id, 120) || `supplier-${crypto.randomUUID()}`,
  legalName: cleanText(item.legalName, 180), tradeName: cleanText(item.tradeName, 180),
  document: digits(item.document).slice(0, 14), phone: cleanText(item.phone, 40), email: cleanText(item.email, 180),
  pixKey: cleanText(item.pixKey, 180), bankDetails: cleanText(item.bankDetails, 500),
  serviceType: cleanText(item.serviceType, 140), notes: cleanText(item.notes, 500),
  createdAt: cleanText(item.createdAt, 40) || new Date().toISOString(), updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
});

const normalizePayment = (item = {}) => ({
  id: cleanText(item.id, 120) || `payment-${crypto.randomUUID()}`,
  inaugurationId: cleanText(item.inaugurationId, 120), actionId: cleanText(item.actionId, 100),
  unit: cleanText(item.unit, 180), openingDate: cleanDate(item.openingDate), actionName: cleanText(item.actionName, 180),
  supplierId: cleanText(item.supplierId, 120), amount: cleanMoney(item.amount), dueDate: cleanDate(item.dueDate),
  status: STATUSES.includes(item.status) ? item.status : 'draft', documentNumber: cleanText(item.documentNumber, 100),
  documentReference: cleanText(item.documentReference, 500), notes: cleanText(item.notes, 700), approvedBy: cleanText(item.approvedBy, 140),
  sentAt: cleanText(item.sentAt, 40), paidAt: cleanText(item.paidAt, 40),
  createdAt: cleanText(item.createdAt, 40) || new Date().toISOString(), updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
});

const validatePayload = (payload) => {
  if (!Array.isArray(payload?.suppliers) || !Array.isArray(payload?.payments)) return 'Os campos suppliers e payments precisam ser listas.';
  if (payload.suppliers.length > MAX_SUPPLIERS) return `Limite de ${MAX_SUPPLIERS} fornecedores excedido.`;
  if (payload.payments.length > MAX_PAYMENTS) return `Limite de ${MAX_PAYMENTS} pagamentos excedido.`;
  const supplierIds = new Set();
  for (const raw of payload.suppliers) {
    const supplier = normalizeSupplierPlain(raw);
    if (!supplier.legalName) return 'Todo fornecedor precisa de nome ou razão social.';
    if (![11, 14].includes(supplier.document.length)) return `CPF/CNPJ inválido para ${supplier.legalName}.`;
    if (supplierIds.has(supplier.id)) return 'Há fornecedores duplicados.';
    supplierIds.add(supplier.id);
  }
  for (const raw of payload.payments) {
    const payment = normalizePayment(raw);
    if (!payment.inaugurationId || !payment.actionId || !payment.unit || !payment.actionName) return 'Todo pagamento precisa estar ligado a uma inauguração e ação.';
    if (!supplierIds.has(payment.supplierId)) return `Fornecedor não encontrado para o pagamento de ${payment.actionName}.`;
    if (payment.amount <= 0) return `Informe um valor válido para ${payment.actionName}.`;
  }
  return null;
};

const encryptSupplier = async (plain, env) => ({
  id: plain.id, legalName: plain.legalName, tradeName: plain.tradeName,
  documentEnc: await encryptText(plain.document, env), phone: plain.phone, email: plain.email,
  pixKeyEnc: await encryptText(plain.pixKey, env), bankDetailsEnc: await encryptText(plain.bankDetails, env),
  serviceType: plain.serviceType, notes: plain.notes, createdAt: plain.createdAt, updatedAt: plain.updatedAt,
});

const decryptSupplier = async (stored, env) => normalizeSupplierPlain({
  ...stored,
  document: await decryptText(stored.documentEnc, env),
  pixKey: await decryptText(stored.pixKeyEnc, env),
  bankDetails: await decryptText(stored.bankDetailsEnc, env),
});

const readDocument = async (store, env) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  if (!stored) return { revision: null, updatedAt: null, suppliers: [], payments: [] };
  const suppliers = await Promise.all((stored.suppliers || []).slice(0, MAX_SUPPLIERS).map((item) => decryptSupplier(item, env)));
  return { revision: stored.revision || null, updatedAt: stored.updatedAt || null, suppliers, payments: (stored.payments || []).slice(0, MAX_PAYMENTS).map(normalizePayment) };
};

const configurationError = (env) => {
  if (!isAccessConfigured(env)) return 'PLANET_HUB_ACCESS_PASSWORD não configurado.';
  if (!getStore(env)) return 'PLANET_HUB_DATA não configurado.';
  if (!encryptionConfigured(env)) return 'PLANET_HUB_ENCRYPTION_KEY precisa ter pelo menos 24 caracteres.';
  return null;
};

export async function onRequestGet({ env }) {
  const error = configurationError(env);
  if (error) return json({ error, configured: false }, 503);
  try { return json({ ...(await readDocument(getStore(env), env)), configured: true }); }
  catch (cause) { return json({ error: 'Falha ao carregar o financeiro.', details: cause instanceof Error ? cause.message : String(cause) }, 500); }
}

export async function onRequestPut({ env, request }) {
  const configError = configurationError(env);
  if (configError) return json({ error: configError, configured: false }, 503);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  const validationError = validatePayload(payload);
  if (validationError) return json({ error: validationError }, 400);
  try {
    const store = getStore(env);
    const current = await readDocument(store, env);
    if (payload.baseRevision && current.revision && payload.baseRevision !== current.revision) return json({ error: 'Os dados financeiros foram alterados em outro navegador.', conflict: true, ...current }, 409);
    const updatedAt = new Date().toISOString();
    const suppliersPlain = payload.suppliers.map((item) => normalizeSupplierPlain({ ...item, updatedAt: item.updatedAt || updatedAt }));
    const suppliers = await Promise.all(suppliersPlain.map((item) => encryptSupplier(item, env)));
    const payments = payload.payments.map((item) => normalizePayment({ ...item, updatedAt: item.updatedAt || updatedAt }));
    const stored = { revision: crypto.randomUUID(), updatedAt, suppliers, payments };
    const serialized = JSON.stringify(stored);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) return json({ error: 'Dados acima do limite permitido.' }, 413);
    await store.put(STORAGE_KEY, serialized);
    return json({ revision: stored.revision, updatedAt, suppliers: suppliersPlain, payments, configured: true });
  } catch (cause) { return json({ error: 'Falha ao salvar o financeiro.', details: cause instanceof Error ? cause.message : String(cause) }, 500); }
}

export function onRequestOptions() { return new Response(null, { status: 204, headers }); }
