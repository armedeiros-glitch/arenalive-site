import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sharedSource = fs.readFileSync(new URL('../planet-hub/assets/payment-document-v1.js', import.meta.url), 'utf8');
const requestSource = fs.readFileSync(new URL('../planet-hub/assets/payment-request-print-v1.js', import.meta.url), 'utf8');
const quickSource = fs.readFileSync(new URL('../planet-hub/assets/payment-quick-flow-v1.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

const context = {
  window: {},
  Intl,
  Date,
  console,
};
vm.createContext(context);
vm.runInContext(sharedSource, context);

const service = context.window.PlanetPaymentDocument;
assert.ok(service, 'o contrato compartilhado deve ser publicado');
assert.equal(service.formatDocument('12345678901'), '123.456.789-01');
assert.equal(service.formatDocument('12345678000199'), '12.345.678/0001-99');
assert.equal(service.escapeHtml('<b>Teste</b>'), '&lt;b&gt;Teste&lt;/b&gt;');

const payment = {
  id: 'payment-12345678',
  unit: 'Unidade Centro',
  openingDate: '2026-08-05',
  actionName: 'Influenciador local',
  supplierId: 'supplier-1',
  amount: 1250,
  dueDate: '2026-08-10',
  status: 'awaiting_approval',
  documentNumber: 'NF-77',
  documentReference: 'Campanha de inauguração',
  approvedBy: 'André Medeiros',
  notes: 'Primeira linha\nSegunda linha',
};
const supplier = {
  legalName: 'Fornecedor Teste Ltda',
  tradeName: 'Fornecedor Teste',
  document: '12345678000199',
  serviceType: 'Publicidade',
  phone: '(47) 99999-0000',
  email: 'financeiro@example.com',
  pixKey: 'pix@example.com',
  bankDetails: 'Banco 001\nAgência 1234',
};

const registered = service.renderReport(payment, supplier, { mode: 'registered' });
const quick = service.renderReport(payment, supplier, { mode: 'quick' });

for (const html of [registered, quick]) {
  assert.match(html, /Solicitação de pagamento/);
  assert.match(html, /Unidade Centro/);
  assert.match(html, /Fornecedor Teste Ltda/);
  assert.match(html, /12\.345\.678\/0001-99/);
  assert.match(html, /R\$\s*1\.250,00/);
  assert.match(html, /Primeira linha<br>Segunda linha/);
  assert.match(html, /Dados de pagamento conferidos/);
}

assert.match(registered, /class="doc-meta"/);
assert.match(registered, /Status: Aguardando aprovação/);
assert.match(registered, /class="checkline"/);
assert.match(quick, /class="meta"/);
assert.doesNotMatch(quick, /Status:/);
assert.match(quick, /class="checks"/);

assert.match(service.renderLoading({ mode: 'registered' }), /Preparando a solicitação de pagamento/);
assert.match(service.renderLoading({ mode: 'quick' }), /Salvando os dados e preparando a impressão/);
assert.match(service.renderError('<falha>', { mode: 'registered' }), /&lt;falha&gt;/);
assert.match(service.renderError('<falha>', { mode: 'quick' }), /&lt;falha&gt;/);

assert.match(requestSource, /window\.PlanetPaymentDocument/);
assert.match(requestSource, /renderReport\(payment, supplier, \{ mode: 'registered' \}\)/);
assert.doesNotMatch(requestSource, /const reportDocument/);
assert.doesNotMatch(requestSource, /@page\{size:A4/);

assert.match(quickSource, /window\.PlanetPaymentDocument/);
assert.match(quickSource, /renderReport\(savedPayment, savedSupplier, \{ mode: 'quick' \}\)/);
assert.doesNotMatch(quickSource, /const reportDocument/);
assert.doesNotMatch(quickSource, /@page\{size:A4/);

const sharedIndex = indexSource.indexOf('payment-document-v1.js');
const requestIndex = indexSource.indexOf('payment-request-print-v1.js');
const quickIndex = indexSource.indexOf('payment-quick-flow-v1.js');
assert.ok(sharedIndex >= 0, 'a entrada oficial deve carregar o contrato compartilhado');
assert.ok(sharedIndex < requestIndex, 'o contrato deve carregar antes da solicitação cadastrada');
assert.ok(sharedIndex < quickIndex, 'o contrato deve carregar antes do fluxo rápido');

console.log('AndreOS shared payment document: tests passed');
