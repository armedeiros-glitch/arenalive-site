import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/inauguration-finance-report-v1.js');
const finance = read('planet-hub/assets/financeiro-v1.js');
const access = read('planet-hub/assets/hub-access-v1.js');

assert.match(source, /Gerar relatório para o Financeiro/);
assert.match(finance, /Exportar esta implantação/, 'CSV existente deve permanecer disponível');
assert.match(source, /currentInaugurationId/);
assert.match(source, /payment\.inaugurationId \|\| ''\) === inaugurationId/);
assert.match(source, /financeDomain\.calculate\(inauguration, financeDomain\.payments \|\| \[\]\)/,
  'relatório deve reutilizar o cálculo financeiro central');
assert.doesNotMatch(source, /Math\.max\(.*actual.*requested|availableBalance\s*=|committed\s*=/s,
  'relatório não pode duplicar a regra financeira');
assert.match(source, /@page \{ size: A4 portrait; margin: 10mm; \}/);
assert.match(source, /@media print/);
assert.match(source, /\.report-actions \{ display: none !important; \}/);
assert.match(source, /andre-os-sidebar|pmh-sidebar/);
assert.match(source, /window\.print\(\)/);
assert.match(source, /supplier\.document \?/);
assert.match(source, /supplier\.pixKey \?/);
assert.match(source, /supplier\.bankDetails \?/);
assert.doesNotMatch(source, /localStorage\.setItem|method:\s*['"](?:POST|PUT|DELETE)['"]|indexedDB|sessionStorage\.setItem/,
  'relatório não pode criar persistência ou escrita de backend');
assert.match(access, /inauguration-finance-report-v1\.js\?v=20260812-1/);

const listeners = new Map();
const document = {
  addEventListener(name, handler) { listeners.set(name, handler); },
  querySelector() { return null; },
  createElement() { return { dataset: {}, before() {}, textContent: '', type: '' }; },
};
const localStorage = { getItem() { return '[]'; } };
const window = {
  localStorage,
  PlanetInaugurationFinance: {
    payments: [],
    calculate(inauguration, payments) {
      const active = payments.filter((payment) => payment.inaugurationId === inauguration.id && payment.status !== 'rejected');
      const requested = active.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
      const actual = 1000;
      return {
        budget: 4100,
        planned: 1900,
        actual,
        requested,
        sent: active.filter((payment) => ['sent_finance', 'paid'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        paid: active.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        committed: Math.max(actual, requested),
        availableBalance: 4100 - Math.max(actual, requested),
      };
    },
  },
  addEventListener(name, handler) { listeners.set(name, handler); },
  setTimeout() { return 1; },
  open() { return null; },
  alert() {},
};

vm.runInNewContext(source, {
  window,
  document,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  Intl,
  Date,
  Map,
  Set,
  String,
  Number,
  Error,
  console,
});

const report = window.PlanetInaugurationFinanceReport;
assert.ok(report?.buildReportHtml, 'builder do relatório deve ficar disponível no módulo');

const inauguration = {
  id: 'i-1',
  unit: 'Planet Joinville',
  location: 'Shopping Exemplo · Joinville/SC',
  openingDate: '2026-09-20',
  responsible: 'André',
  packageBudget: 4100,
};
window.PlanetInaugurationFinance.payments = [
  { id: 'p1', inaugurationId: 'i-1', supplierId: 's1', actionName: 'Influenciadores', amount: 1500, dueDate: '2026-09-10', status: 'awaiting_approval', documentNumber: 'NF 123', notes: 'Pagamento referente à campanha local.' },
  { id: 'p2', inaugurationId: 'i-1', supplierId: 's2', actionName: 'Decoração', amount: 900, status: 'rejected', documentNumber: 'REC 9' },
  { id: 'p3', inaugurationId: 'outra', supplierId: 's3', actionName: 'Não pode aparecer', amount: 9999, status: 'paid' },
];
const currentPayments = report.paymentsFor('i-1');
assert.equal(currentPayments.length, 2, 'somente pagamentos da inauguração atual devem entrar');

const html = report.buildReportHtml({
  inauguration,
  payments: currentPayments,
  suppliers: [
    { id: 's1', legalName: 'Fornecedor Um', document: '12345678000199', pixKey: 'pix@fornecedor.com', bankDetails: 'Banco 001 · Ag 1234 · Conta 56789-0' },
    { id: 's2', legalName: 'Fornecedor Dois' },
    { id: 's3', legalName: 'Fornecedor Outra Unidade', pixKey: 'nao@mostrar.com' },
  ],
});

assert.match(html, /Planet Joinville/);
assert.match(html, /Shopping Exemplo · Joinville\/SC/);
assert.match(html, /20\/09\/2026/);
assert.match(html, /André/);
assert.match(html, /Verba do pacote[\s\S]*R\$\s*4\.100,00/);
assert.match(html, /Planejado[\s\S]*R\$\s*1\.900,00/);
assert.match(html, /Gasto realizado[\s\S]*R\$\s*1\.000,00/);
assert.match(html, /Valor comprometido[\s\S]*R\$\s*1\.500,00/);
assert.match(html, /Saldo disponível[\s\S]*R\$\s*2\.600,00/);
assert.match(html, /Valor solicitado[\s\S]*R\$\s*1\.500,00/,
  'rejected deve ficar fora dos totais centrais');
assert.match(html, /Valor pago[\s\S]*R\$\s*0,00/);
assert.match(html, /Influenciadores/);
assert.match(html, /Fornecedor Um/);
assert.match(html, /10\/09\/2026/);
assert.match(html, /Aguardando aprovação/);
assert.match(html, /NF 123/);
assert.match(html, /Decoração/);
assert.match(html, /Recusado/);
assert.match(html, /REC 9/);
assert.doesNotMatch(html, /Não pode aparecer|Fornecedor Outra Unidade|nao@mostrar\.com/);
assert.match(html, /12345678000199/);
assert.match(html, /pix@fornecedor\.com/);
assert.match(html, /Banco 001 · Ag 1234 · Conta 56789-0/);
assert.match(html, /Obs\.: Pagamento referente à campanha local\./);
assert.match(html, /Imprimir \/ Salvar em PDF/);
assert.match(html, /report-actions/);

const noBankHtml = report.buildReportHtml({
  inauguration,
  payments: [{ id: 'p2', inaugurationId: 'i-1', supplierId: 's2', amount: 900, status: 'rejected' }],
  suppliers: [{ id: 's2', legalName: 'Fornecedor Dois' }],
});
assert.doesNotMatch(noBankHtml, /Dados para pagamento/, 'se não houver dados bancários, seção não deve inventar informação');

console.log('Inaugurações: relatório financeiro A4, dados atuais, impressão e segurança validados.');
