const tests = [
  './inauguration-workspace-v2.test.mjs',
  './inaugurations-persistence-v2.test.mjs',
  './finance-manual-payment-v1.test.mjs',
  './finance-balance-v1.test.mjs',
  './finance-stability-v1.test.mjs',
  './inaugurations-v2-cache.test.mjs',
];

for (const test of tests) await import(test);

console.log('AndreOS Inaugurações V2: suíte completa passou');
