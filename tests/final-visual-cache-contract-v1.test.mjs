import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

const expectedVersions = new Map([
  ['andre-os-visual-system-v1.css', '20260806-2'],
  ['andre-os-operations-v1.css', '20260806-2'],
  ['inauguration-workspace-v2.css', '20260808-2'],
  ['ticket-command-v1.css', '20260807-4'],
  ['calendar-operations-v1.css', '20260808-1'],
  ['content-library-v1.css', '20260808-1'],
  ['internal-demands-v1.css', '20260813-1'],
  ['active-workstream-v1.css', '20260806-2'],
  ['andre-os-shell-home-v1.css', '20260806-2'],
  ['andre-os-feedback-v1.css', '20260806-1'],
]);

for (const [file, version] of expectedVersions) {
  assert.match(
    html,
    new RegExp(`${file.replaceAll('.', '\\.') }\\?v=${version}`),
    `${file} precisa publicar a versão visual ${version}`,
  );
}

assert.match(html, /media="\(max-width: 820px\)"[^>]+andre-os-dark-theme-v1\.css/);
assert.doesNotMatch(html, /andre-os-desktop-radar-dark-v1\.css/);

console.log('Contrato de cache e escopo visual validado.');
