(() => {
  'use strict';

  const API = '/api/hub/planet/five-stars/evaluations';
  const ACTIVE_HASHES = new Set(['5-estrelas', 'cinco-estrelas', '5estrelas']);
  const XLSX_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const MAX_ROWS = 500;
  const LIMITS = { commercial: 35, experience: 25, marketing: 20, management: 20 };
  const FIELDS = [
    { key: 'unit', label: 'Unidade', required: true },
    { key: 'cycle', label: 'Ciclo', required: false },
    { key: 'evaluatedAt', label: 'Data', required: false },
    { key: 'commercial', label: 'Resultado Comercial /35', required: true },
    { key: 'experience', label: 'Experiência do Cliente /25', required: true },
    { key: 'marketing', label: 'Marketing e Participação /20', required: true },
    { key: 'management', label: 'Gestão da Franquia /20', required: true },
    { key: 'hiddenShopper', label: 'Cliente oculto', required: false },
    { key: 'reportsOnTime', label: 'DRE e fluxos no prazo', required: false },
    { key: 'noSeriousPending', label: 'Sem pendência grave', required: false },
    { key: 'notes', label: 'Observações', required: false },
  ];
  const SYNONYMS = {
    unit: ['unidade', 'loja', 'nome da loja', 'franquia', 'nome unidade', 'nome da unidade'],
    cycle: ['ciclo', 'semestre', 'periodo', 'período', 'ciclo avaliacao', 'ciclo avaliação'],
    evaluatedAt: ['data', 'data avaliacao', 'data avaliação', 'avaliado em', 'data da avaliacao', 'data da avaliação'],
    commercial: ['resultado comercial', 'comercial', 'nota comercial', 'resultado', 'resultado comercial 35', 'comercial 35'],
    experience: ['experiencia do cliente', 'experiência do cliente', 'experiencia', 'experiência', 'nota experiencia', 'nota experiência', 'experiencia 25', 'experiência 25'],
    marketing: ['marketing e participacao', 'marketing e participação', 'marketing', 'participacao', 'participação', 'marketing 20'],
    management: ['gestao da franquia', 'gestão da franquia', 'gestao', 'gestão', 'nota gestao', 'nota gestão', 'gestao 20', 'gestão 20'],
    hiddenShopper: ['cliente oculto', 'cliente secreto', 'hidden shopper'],
    reportsOnTime: ['dre e fluxos no prazo', 'dre no prazo', 'fluxo no prazo', 'relatorios no prazo', 'relatórios no prazo', 'dre fluxo'],
    noSeriousPending: ['sem pendencia grave', 'sem pendência grave', 'pendencia grave', 'pendência grave', 'sem pendencias graves', 'sem pendências graves'],
    notes: ['observacoes', 'observações', 'obs', 'notas', 'comentarios', 'comentários'],
  };

  const state = {
    fileName: '', sheetName: '', headers: [], rows: [], mapping: {}, existing: [],
    entries: [], duplicateStrategy: 'update', defaultCycle: '', defaultDate: '', loading: false,
  };
  let frame = 0;
  let xlsxPromise = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const active = () => ACTIVE_HASHES.has(String(location.hash || '').replace(/^#/, '').toLowerCase());
  const normalize = (value) => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[_\-\/]+/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizeUnit = (value) => normalize(value);
  const today = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const currentCycle = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric',
    }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === 'year')?.value || new Date().getFullYear());
    const month = Number(parts.find((part) => part.type === 'month')?.value || 1);
    return `${year}-S${month <= 6 ? 1 : 2}`;
  };
  const cycleLabel = (cycle) => {
    const match = String(cycle || '').match(/^(\d{4})-S([12])$/);
    return match ? `${match[2]}º semestre de ${match[1]}` : String(cycle || '');
  };
  const keyFor = (unit, cycle) => `${normalizeUnit(unit)}::${cycle}`;

  const ensureXlsx = () => {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_CDN;
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('Biblioteca Excel não ficou disponível.'));
      script.onerror = () => reject(new Error('Não foi possível carregar o leitor de Excel.'));
      document.head.appendChild(script);
    }).catch((error) => {
      xlsxPromise = null;
      throw error;
    });
    return xlsxPromise;
  };

  const uniqueHeaders = (values) => {
    const used = new Map();
    return values.map((raw, index) => {
      const base = String(raw ?? '').trim() || `Coluna ${index + 1}`;
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      return count === 1 ? base : `${base} (${count})`;
    });
  };

  const matrixToRows = (matrix) => {
    const meaningful = (Array.isArray(matrix) ? matrix : []).filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));
    if (meaningful.length < 2) throw new Error('A planilha precisa ter cabeçalho e pelo menos uma linha de dados.');
    const headers = uniqueHeaders(meaningful[0]);
    const rows = meaningful.slice(1, MAX_ROWS + 1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
    if (meaningful.length - 1 > MAX_ROWS) throw new Error(`A importação aceita até ${MAX_ROWS} linhas por vez.`);
    return { headers, rows };
  };

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (!quoted && (char === ',' || char === ';')) {
        const delimiter = text.includes(';') && !text.split(/\r?\n/, 1)[0].includes(',') ? ';' : ',';
        if (char === delimiter) { row.push(cell); cell = ''; continue; }
      }
      if (!quoted && (char === '\n' || (char === '\r' && next === '\n'))) {
        row.push(cell); rows.push(row); row = []; cell = '';
        if (char === '\r') index += 1;
        continue;
      }
      cell += char;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return matrixToRows(rows);
  };

  const readFile = async (file) => {
    if (!file) throw new Error('Selecione uma planilha.');
    if (file.size > MAX_FILE_BYTES) throw new Error('A planilha pode ter no máximo 5 MB.');
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension === 'csv') {
      const parsed = parseCsv(await file.text());
      return { ...parsed, sheetName: 'CSV' };
    }
    if (!['xlsx', 'xls'].includes(extension)) throw new Error('Use um arquivo .xlsx, .xls ou .csv.');
    const XLSX = await ensureXlsx();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames.find((name) => {
      const ref = workbook.Sheets[name]?.['!ref'];
      return Boolean(ref);
    }) || workbook.SheetNames[0];
    if (!sheetName) throw new Error('Não encontrei nenhuma aba com dados.');
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: true });
    return { ...matrixToRows(matrix), sheetName };
  };

  const autoMap = (headers) => {
    const normalizedHeaders = headers.map((header) => ({ header, normalized: normalize(header) }));
    const mapping = {};
    FIELDS.forEach((field) => {
      const aliases = (SYNONYMS[field.key] || []).map(normalize);
      const exact = normalizedHeaders.find((item) => aliases.includes(item.normalized));
      const partial = exact || normalizedHeaders.find((item) => aliases.some((alias) => item.normalized.includes(alias) || alias.includes(item.normalized)));
      mapping[field.key] = partial?.header || '';
    });
    return mapping;
  };

  const parseScore = (value, max) => {
    const text = String(value ?? '').trim().replace(',', '.');
    if (!text) return { error: 'nota vazia' };
    const number = Number(text);
    if (!Number.isFinite(number)) return { error: `nota inválida: ${text}` };
    if (number < 0 || number > max) return { error: `nota ${number} fora do limite 0–${max}` };
    return { value: Math.round(number * 10) / 10 };
  };

  const parseCycle = (value) => {
    const raw = String(value ?? '').trim().toUpperCase();
    if (!raw) return '';
    let match = raw.match(/^(\d{4})\s*[-\/]?\s*S([12])$/);
    if (match) return `${match[1]}-S${match[2]}`;
    match = raw.match(/^S([12])\s*[-\/]?\s*(\d{4})$/);
    if (match) return `${match[2]}-S${match[1]}`;
    match = raw.match(/^([12])\s*(?:º|O)?\s*(?:SEMESTRE)?\s*(?:DE)?\s*(\d{4})$/);
    if (match) return `${match[2]}-S${match[1]}`;
    match = raw.match(/^(\d{4})\s*[-\/]\s*([12])$/);
    if (match) return `${match[1]}-S${match[2]}`;
    return '';
  };

  const dateFromExcelSerial = (serial) => {
    const number = Number(serial);
    if (!Number.isFinite(number) || number < 1 || number > 100000) return '';
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(number) * 86400000);
    return date.toISOString().slice(0, 10);
  };

  const parseDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === 'number') return dateFromExcelSerial(value);
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
    return '';
  };

  const parseRequirement = (value, invert = false) => {
    const normalized = normalize(value);
    if (!normalized) return 'pending';
    const positive = ['sim', 's', 'ok', 'conforme', 'aprovado', 'aprovada', 'true', '1', 'em dia', 'sem pendencia', 'sem pendencias'];
    const negative = ['nao', 'n', 'falha', 'reprovado', 'reprovada', 'false', '0', 'atrasado', 'atrasada', 'com pendencia', 'com pendencias'];
    let stateValue = positive.includes(normalized) ? 'ok' : negative.includes(normalized) ? 'fail' : 'pending';
    if (invert && stateValue !== 'pending') stateValue = stateValue === 'ok' ? 'fail' : 'ok';
    return stateValue;
  };

  const loadExisting = async () => {
    const response = await fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    state.existing = Array.isArray(payload.data) ? payload.data : [];
  };

  const mappedValue = (row, field) => state.mapping[field] ? row[state.mapping[field]] : '';

  const rebuildEntries = () => {
    const existingMap = new Map();
    state.existing.forEach((item) => existingMap.set(keyFor(item.unit, item.cycle), item));
    const seen = new Set();
    state.entries = state.rows.map((row, index) => {
      const errors = [];
      const unit = String(mappedValue(row, 'unit') ?? '').trim();
      const cycle = state.mapping.cycle ? parseCycle(mappedValue(row, 'cycle')) : state.defaultCycle;
      const evaluatedAt = state.mapping.evaluatedAt ? parseDate(mappedValue(row, 'evaluatedAt')) : state.defaultDate;
      if (!unit) errors.push('unidade vazia');
      if (!cycle) errors.push('ciclo inválido');
      if (!evaluatedAt) errors.push('data inválida');
      const scores = {};
      Object.entries(LIMITS).forEach(([field, max]) => {
        const parsed = parseScore(mappedValue(row, field), max);
        if (parsed.error) errors.push(`${FIELDS.find((item) => item.key === field)?.label || field}: ${parsed.error}`);
        else scores[field] = parsed.value;
      });
      const key = unit && cycle ? keyFor(unit, cycle) : `invalid-${index}`;
      if (seen.has(key)) errors.push('unidade e ciclo repetidos dentro da própria planilha');
      seen.add(key);
      const existing = existingMap.get(key) || null;
      const evaluation = {
        ...(existing && state.duplicateStrategy === 'update' ? { id: existing.id } : {}),
        unit, cycle, evaluatedAt, scores,
        requirements: {
          hiddenShopper: state.mapping.hiddenShopper ? parseRequirement(mappedValue(row, 'hiddenShopper')) : 'pending',
          reportsOnTime: state.mapping.reportsOnTime ? parseRequirement(mappedValue(row, 'reportsOnTime')) : 'pending',
          noSeriousPending: state.mapping.noSeriousPending ? parseRequirement(mappedValue(row, 'noSeriousPending')) : 'pending',
        },
        notes: state.mapping.notes ? String(mappedValue(row, 'notes') ?? '').trim().slice(0, 2000) : '',
      };
      return { index: index + 2, evaluation, errors, existing };
    });
  };

  const selectOptions = (selected) => `<option value="">Não usar esta coluna</option>${state.headers.map((header) => `<option value="${esc(header)}" ${header === selected ? 'selected' : ''}>${esc(header)}</option>`).join('')}`;

  const entryStatus = (entry) => {
    if (entry.errors.length) return { cls: 'error', label: entry.errors[0] };
    if (entry.existing) return state.duplicateStrategy === 'update'
      ? { cls: 'duplicate', label: 'Atualizar avaliação existente' }
      : { cls: 'skip', label: 'Ignorar duplicada' };
    return { cls: 'ready', label: 'Pronta para importar' };
  };

  const previewStats = () => {
    rebuildEntries();
    const errors = state.entries.filter((entry) => entry.errors.length).length;
    const duplicates = state.entries.filter((entry) => !entry.errors.length && entry.existing).length;
    const skipped = state.duplicateStrategy === 'skip' ? duplicates : 0;
    const ready = state.entries.filter((entry) => !entry.errors.length && (!entry.existing || state.duplicateStrategy === 'update')).length;
    return { errors, duplicates, skipped, ready, total: state.entries.length };
  };

  const modalBody = () => document.querySelector('[data-p5-import-modal] [data-p5-import-body]');

  const previewMarkup = () => {
    const stats = previewStats();
    const rows = state.entries.slice(0, 10);
    return `
      <section class="p5-import-preview">
        <div class="p5-import-stats">
          <span><strong>${stats.total}</strong> linhas</span>
          <span class="ready"><strong>${stats.ready}</strong> prontas</span>
          <span class="duplicate"><strong>${stats.duplicates}</strong> duplicadas</span>
          <span class="error"><strong>${stats.errors}</strong> com problema</span>
        </div>
        ${stats.duplicates ? `<div class="p5-import-duplicates"><strong>Quando já existir Unidade + Ciclo:</strong><label><input type="radio" name="p5-duplicate" value="update" ${state.duplicateStrategy === 'update' ? 'checked' : ''}> Atualizar existente</label><label><input type="radio" name="p5-duplicate" value="skip" ${state.duplicateStrategy === 'skip' ? 'checked' : ''}> Ignorar duplicada</label></div>` : ''}
        <div class="p5-import-table-wrap"><table class="p5-import-table"><thead><tr><th>Linha</th><th>Unidade</th><th>Ciclo</th><th>Notas</th><th>Status</th></tr></thead><tbody>
          ${rows.map((entry) => {
            const status = entryStatus(entry);
            const scores = entry.evaluation.scores || {};
            const total = Object.values(scores).reduce((sum, value) => sum + (Number(value) || 0), 0);
            return `<tr><td>${entry.index}</td><td>${esc(entry.evaluation.unit || '—')}</td><td>${esc(entry.evaluation.cycle || '—')}</td><td>${entry.errors.length ? '—' : `${total.toLocaleString('pt-BR')}/100`}</td><td><span class="p5-import-row-status ${status.cls}" title="${esc(entry.errors.join(' · '))}">${esc(status.label)}</span></td></tr>`;
          }).join('')}
        </tbody></table></div>
        ${state.entries.length > 10 ? `<p class="p5-import-more">Prévia das primeiras 10 linhas. Mais ${state.entries.length - 10} serão validadas da mesma forma.</p>` : ''}
        ${stats.errors ? `<p class="p5-import-warning">${stats.errors} ${stats.errors === 1 ? 'linha tem problema e será ignorada' : 'linhas têm problemas e serão ignoradas'}. Corrija a planilha ou o mapeamento para importá-las.</p>` : ''}
        <footer class="p5-import-footer"><button type="button" class="secondary" data-p5-import-back>Trocar arquivo</button><button type="button" class="primary" data-p5-import-run ${stats.ready ? '' : 'disabled'}>Importar ${stats.ready} ${stats.ready === 1 ? 'avaliação' : 'avaliações'}</button></footer>
      </section>`;
  };

  const renderMapping = () => {
    const body = modalBody();
    if (!body) return;
    const stats = previewStats();
    body.innerHTML = `
      <section class="p5-import-filebar"><div><small>ARQUIVO</small><strong>${esc(state.fileName)}</strong><span>${esc(state.sheetName)} · ${state.rows.length} linhas</span></div><button type="button" data-p5-import-back>Trocar</button></section>
      <section class="p5-import-defaults"><label><span>Ciclo padrão <small>usado se a planilha não tiver ciclo</small></span><select data-p5-default-cycle>${[-2, -1, 0, 1, 2].map((offset) => {
        const current = currentCycle();
        const [yearText, semesterText] = current.split('-S');
        const absolute = Number(yearText) * 2 + Number(semesterText) - 1 + offset;
        const year = Math.floor(absolute / 2);
        const semester = (absolute % 2) + 1;
        const value = `${year}-S${semester}`;
        return `<option value="${value}" ${value === state.defaultCycle ? 'selected' : ''}>${esc(cycleLabel(value))}</option>`;
      }).join('')}</select></label><label><span>Data padrão <small>usada se a planilha não tiver data</small></span><input type="date" data-p5-default-date value="${esc(state.defaultDate)}"></label></section>
      <section class="p5-import-mapping"><header><div><small>CORRESPONDÊNCIA</small><h3>Confira o que cada coluna significa</h3></div><span>${stats.errors ? 'Revise os campos em vermelho na prévia' : 'Mapeamento automático aplicado'}</span></header><div class="p5-import-map-grid">
        ${FIELDS.map((field) => `<label class="${field.required ? 'required' : ''}"><span>${esc(field.label)}${field.required ? ' *' : ''}</span><select data-p5-map="${field.key}">${selectOptions(state.mapping[field.key])}</select></label>`).join('')}
      </div></section>
      ${previewMarkup()}`;
  };

  const uploadMarkup = (message = '') => `
    <section class="p5-import-upload">
      <label class="p5-import-drop" data-p5-import-drop>
        <input type="file" accept=".xlsx,.xls,.csv" data-p5-import-file hidden>
        <span class="p5-import-icon">⇧</span><strong>Arraste sua planilha aqui</strong><em>ou clique para escolher</em><small>Excel .xlsx/.xls ou CSV · até 5 MB · máximo ${MAX_ROWS} linhas</small>
      </label>
      ${message ? `<p class="p5-import-error">${esc(message)}</p>` : ''}
      <div class="p5-import-template-callout"><div><strong>Quer começar do formato certo?</strong><span>Baixe o modelo com as colunas do Planet 5 Estrelas.</span></div><button type="button" data-p5-download-template>Baixar modelo Excel</button></div>
    </section>`;

  const openModal = () => {
    document.querySelector('[data-p5-import-modal]')?.remove();
    state.fileName = ''; state.sheetName = ''; state.headers = []; state.rows = []; state.mapping = {}; state.entries = [];
    state.defaultCycle = currentCycle(); state.defaultDate = today(); state.duplicateStrategy = 'update';
    const backdrop = document.createElement('div');
    backdrop.className = 'p5-import-backdrop';
    backdrop.dataset.p5ImportModal = 'true';
    backdrop.innerHTML = `<section class="p5-import-modal" role="dialog" aria-modal="true" aria-labelledby="p5-import-title"><header><div><small>PLANET 5 ESTRELAS</small><h2 id="p5-import-title">Importar planilha</h2><p>Jogue o Excel. O André OS confere as colunas e mostra uma prévia antes de gravar.</p></div><button type="button" class="p5-import-close" data-p5-import-close aria-label="Fechar">×</button></header><div data-p5-import-body>${uploadMarkup()}</div></section>`;
    document.body.appendChild(backdrop);
  };

  const processFile = async (file) => {
    const body = modalBody();
    if (body) body.innerHTML = '<section class="p5-import-loading"><span></span><strong>Lendo a planilha…</strong><small>Nenhum dado será salvo antes da sua confirmação.</small></section>';
    try {
      const parsed = await readFile(file);
      state.fileName = file.name;
      state.sheetName = parsed.sheetName;
      state.headers = parsed.headers;
      state.rows = parsed.rows;
      state.mapping = autoMap(parsed.headers);
      await loadExisting();
      renderMapping();
    } catch (error) {
      if (body) body.innerHTML = uploadMarkup(error instanceof Error ? error.message : String(error));
    }
  };

  const postEvaluation = async (evaluation) => {
    const response = await fetch(API, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluation }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const runImport = async () => {
    if (state.loading) return;
    const stats = previewStats();
    const selected = state.entries.filter((entry) => !entry.errors.length && (!entry.existing || state.duplicateStrategy === 'update'));
    if (!selected.length) return;
    state.loading = true;
    const button = document.querySelector('[data-p5-import-run]');
    if (button) { button.disabled = true; button.textContent = `Importando 0/${selected.length}…`; }
    let success = 0;
    let updated = 0;
    const failures = [];
    const concurrency = 6;
    for (let offset = 0; offset < selected.length; offset += concurrency) {
      const batch = selected.slice(offset, offset + concurrency);
      const results = await Promise.allSettled(batch.map((entry) => postEvaluation(entry.evaluation)));
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          success += 1;
          if (batch[index].existing) updated += 1;
        } else {
          failures.push({ entry: batch[index], error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
        }
      });
      if (button) button.textContent = `Importando ${Math.min(offset + concurrency, selected.length)}/${selected.length}…`;
    }
    state.loading = false;
    const body = modalBody();
    if (!body) return;
    const created = success - updated;
    body.innerHTML = `<section class="p5-import-result"><span class="p5-import-result-icon">${failures.length ? '!' : '✓'}</span><small>IMPORTAÇÃO CONCLUÍDA</small><h3>${success} ${success === 1 ? 'avaliação salva' : 'avaliações salvas'}</h3><p>${created} ${created === 1 ? 'nova' : 'novas'} · ${updated} ${updated === 1 ? 'atualizada' : 'atualizadas'}${stats.skipped ? ` · ${stats.skipped} ignoradas` : ''}${stats.errors ? ` · ${stats.errors} linhas inválidas não importadas` : ''}</p>${failures.length ? `<div class="p5-import-failures"><strong>${failures.length} falharam ao salvar:</strong>${failures.slice(0, 5).map((item) => `<span>Linha ${item.entry.index}: ${esc(item.error)}</span>`).join('')}</div>` : ''}<button type="button" class="primary" data-p5-import-refresh>Atualizar Planet 5 Estrelas</button></section>`;
  };

  const fallbackCsvTemplate = () => {
    const headers = ['Unidade', 'Ciclo', 'Data', 'Resultado Comercial', 'Experiência do Cliente', 'Marketing e Participação', 'Gestão da Franquia', 'Cliente oculto', 'DRE e fluxos no prazo', 'Sem pendência grave', 'Observações'];
    const blob = new Blob([`\uFEFF${headers.join(';')}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'modelo-planet-5-estrelas.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = async () => {
    try {
      const XLSX = await ensureXlsx();
      const headers = ['Unidade', 'Ciclo', 'Data', 'Resultado Comercial', 'Experiência do Cliente', 'Marketing e Participação', 'Gestão da Franquia', 'Cliente oculto', 'DRE e fluxos no prazo', 'Sem pendência grave', 'Observações'];
      const workbook = XLSX.utils.book_new();
      const sheet = XLSX.utils.aoa_to_sheet([headers]);
      sheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, Math.min(28, header.length + 2)) }));
      XLSX.utils.book_append_sheet(workbook, sheet, 'Avaliações');
      const instructions = XLSX.utils.aoa_to_sheet([
        ['Campo', 'Como preencher'],
        ['Unidade', 'Nome da unidade. Obrigatório.'],
        ['Ciclo', 'Ex.: 2026-S2. Se ficar vazio, você escolhe o ciclo padrão na importação.'],
        ['Data', 'Ex.: 07/08/2026. Se ficar vazia, você escolhe a data padrão na importação.'],
        ['Resultado Comercial', 'Nota entre 0 e 35.'],
        ['Experiência do Cliente', 'Nota entre 0 e 25.'],
        ['Marketing e Participação', 'Nota entre 0 e 20.'],
        ['Gestão da Franquia', 'Nota entre 0 e 20.'],
        ['Cliente oculto', 'Sim / Não / Em aberto.'],
        ['DRE e fluxos no prazo', 'Sim / Não / Em aberto.'],
        ['Sem pendência grave', 'Sim / Não / Em aberto.'],
      ]);
      instructions['!cols'] = [{ wch: 28 }, { wch: 72 }];
      XLSX.utils.book_append_sheet(workbook, instructions, 'Instruções');
      XLSX.writeFile(workbook, 'modelo-planet-5-estrelas.xlsx');
    } catch (_) {
      fallbackCsvTemplate();
    }
  };

  const decorate = () => {
    if (!active()) return;
    const actions = document.querySelector('[data-p5-page] .p5-data-actions');
    if (!actions || actions.querySelector('[data-p5-import]')) return;
    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.className = 'p5-import-button';
    importButton.dataset.p5Import = 'true';
    importButton.textContent = 'Importar planilha';
    const templateButton = document.createElement('button');
    templateButton.type = 'button';
    templateButton.className = 'p5-template-button';
    templateButton.dataset.p5DownloadTemplate = 'true';
    templateButton.textContent = 'Baixar modelo';
    const first = actions.firstElementChild;
    if (first) actions.insertBefore(importButton, first.nextSibling);
    else actions.appendChild(importButton);
    actions.insertBefore(templateButton, importButton.nextSibling);
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(decorate));
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-p5-import]')) { openModal(); return; }
    if (event.target.closest('[data-p5-download-template]')) { downloadTemplate(); return; }
    if (event.target.closest('[data-p5-import-close]')) { document.querySelector('[data-p5-import-modal]')?.remove(); return; }
    if (event.target.closest('[data-p5-import-back]')) { const body = modalBody(); if (body) body.innerHTML = uploadMarkup(); return; }
    if (event.target.closest('[data-p5-import-run]')) { runImport(); return; }
    if (event.target.closest('[data-p5-import-refresh]')) { location.reload(); }
  });

  document.addEventListener('change', (event) => {
    const fileInput = event.target.closest('[data-p5-import-file]');
    if (fileInput?.files?.[0]) { processFile(fileInput.files[0]); return; }
    const mapSelect = event.target.closest('[data-p5-map]');
    if (mapSelect) { state.mapping[mapSelect.dataset.p5Map] = mapSelect.value; renderMapping(); return; }
    const cycle = event.target.closest('[data-p5-default-cycle]');
    if (cycle) { state.defaultCycle = cycle.value; renderMapping(); return; }
    const date = event.target.closest('[data-p5-default-date]');
    if (date) { state.defaultDate = date.value; renderMapping(); return; }
    const duplicate = event.target.closest('input[name="p5-duplicate"]');
    if (duplicate) { state.duplicateStrategy = duplicate.value; renderMapping(); }
  });

  document.addEventListener('dragover', (event) => {
    const drop = event.target.closest('[data-p5-import-drop]');
    if (!drop) return;
    event.preventDefault();
    drop.classList.add('dragging');
  });
  document.addEventListener('dragleave', (event) => event.target.closest('[data-p5-import-drop]')?.classList.remove('dragging'));
  document.addEventListener('drop', (event) => {
    const drop = event.target.closest('[data-p5-import-drop]');
    if (!drop) return;
    event.preventDefault();
    drop.classList.remove('dragging');
    const file = event.dataTransfer?.files?.[0];
    if (file) processFile(file);
  });

  window.addEventListener('hashchange', schedule);
  window.addEventListener('pmh:view-rendered', schedule);
  window.addEventListener('planet:five-stars-rendered', schedule);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
