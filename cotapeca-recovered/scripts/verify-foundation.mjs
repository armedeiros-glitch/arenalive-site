import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const requiredPaths = [
  'app/page.tsx',
  'app/cotacao/page.tsx',
  'app/supplier/register/page.tsx',
  'app/supplier/opportunities/page.tsx',
  'app/supplier/opportunities/[id]/page.tsx',
  'app/supplier/offers/page.tsx',
  'app/admin/suppliers/page.tsx',
  'app/admin/suppliers/[id]/page.tsx',
  'lib/supabase/client.ts',
  'lib/supabase/server.ts',
];

const expectedMigrations = [
  '20260814172604_sprint0_foundation.sql',
  '20260814174600_harden_security_definer.sql',
  '20260814182000_sprint1_quote_schema.sql',
  '20260814182100_sprint1_quote_helpers.sql',
  '20260814182200_sprint1_submit_quote.sql',
  '20260814182300_sprint1_quote_rls_storage.sql',
  '20260814182400_sprint1_internal_catalog_denies.sql',
  '20260814200011_sprint2_supplier_matching.sql',
  '20260814200044_sprint2_catalog_access_brand_resolution.sql',
  '20260814200148_sprint2_auto_matching.sql',
  '20260814200549_sprint2_fix_phone_regex.sql',
  '20260814200620_sprint2_defer_auto_matching.sql',
  '20260814201220_sprint2_harden_public_rpcs.sql',
  '20260820162901_sprint2_fix_opportunity_created_event.sql',
  '20260821164353_fix_e164_check_constraints.sql',
  '20260821164629_fix_submit_quote_whatsapp_regex.sql',
  '20260821185826_sprint3_offer_foundation.sql',
];

const missingPaths = requiredPaths.filter((path) => !existsSync(join(root, path)));
if (missingPaths.length) {
  throw new Error(`Arquivos obrigatórios ausentes: ${missingPaths.join(', ')}`);
}

const migrationDir = join(root, 'supabase', 'migrations');
if (!existsSync(migrationDir)) throw new Error('Diretório supabase/migrations ausente.');

const currentMigrations = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();
const missingMigrations = expectedMigrations.filter((name) => !currentMigrations.includes(name));
const unexpectedMigrations = currentMigrations.filter((name) => !expectedMigrations.includes(name));

if (missingMigrations.length) {
  throw new Error(`Migrations históricas ausentes: ${missingMigrations.join(', ')}`);
}

if (unexpectedMigrations.length) {
  throw new Error(`Migrations não reconhecidas para Sprint 0-3: ${unexpectedMigrations.join(', ')}`);
}

console.log(`Foundation OK: ${requiredPaths.length} arquivos essenciais e ${currentMigrations.length} migrations verificadas.`);
