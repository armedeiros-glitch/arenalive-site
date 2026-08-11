import assert from 'node:assert/strict';
import { validateBatchReports } from '../functions/_lib/google-analytics.js';

const reports = [{ rows: [] }, { rows: [] }];
assert.equal(validateBatchReports({ reports }, 2), reports);

assert.throws(
  () => validateBatchReports({}, 2),
  /lote incompleto: 0\/2 relatório\(s\)/,
);

assert.throws(
  () => validateBatchReports({ reports: [{ rows: [] }] }, 2),
  /lote incompleto: 1\/2 relatório\(s\)/,
);

assert.throws(
  () => validateBatchReports({ reports: [{}, {}, {}] }, 2),
  /lote incompleto: 3\/2 relatório\(s\)/,
);

console.log('Google Analytics: contrato do batchRunReports validado.');
