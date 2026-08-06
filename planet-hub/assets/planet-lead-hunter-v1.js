(() => {
  'use strict';

  const API = '/api/hub/planet/expansion/candidates';
  const IMPORT_API = `${API}/import`;
  const HUNT_API = '/api/hub/planet/expansion/hunt';
  const OSM_LICENSE_URL = 'https://www.openstreetmap.org/copyright';
  const state = {
    candidates: [],
    loaded: false,
    loading: false,
    importing: false,
    hunting: false,
    huntStatus: null,
    huntReport: null,
    error: '',
    notice: '',
    selectedId: '',
    importPreview: null,
    importReport: null,
    filters: {
      query: '', city: '', state: '', reviewStatus: '', score: '',
      franchiseModel: '', source: '', enrichmentStatus: '', promoted: '',
    },
  };

  let renderFrame = 0;
  let noticeTimer = 0;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const isExpansion = () => location.hash === '#expansao';
  const root = () => document.querySelector('[data-lead-hunter-root]');
  const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const scoreRange = (value) => ({ high: [75, 100], medium: [50, 74], low: [0, 49] }[value] || [0, 100]);
  const fmtDateTime = (value) => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return 'Ainda não executado';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

  const showNotice = (message, tone = 'success') => {
    clearTimeout(noticeTimer);
    state.notice = String(message || '');
    state.error = tone === 'error' ? state.notice : '';
    renderHunter();
    noticeTimer = window.setTimeout(() => {
      state.notice = '';
      if (tone === 'error') state.error = '';
      renderHunter();
    }, 4500);
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const load = async ({ silent = false } = {}) => {
    if (state.loading) return;
    state.loading = true;
    if (!silent) state.error = '';
    renderHunter();
    try {
      const [payload, huntStatus] = await Promise.all([
        requestJson(API),
        requestJson(HUNT_API).catch(() => null),
      ]);
      state.candidates = Array.isArray(payload.data) ? payload.data : [];
      if (huntStatus) state.huntStatus = huntStatus;
      state.loaded = true;
      if (state.selectedId && !state.candidates.some((item) => item.id === state.selectedId)) state.selectedId = '';
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      renderHunter();
    }
  };

  const metrics = () => {
    const total = state.candidates.length;
    const pending = state.candidates.filter((item) => item.reviewStatus === 'pending').length;
    const approved = state.candidates.filter((item) => item.reviewStatus === 'approved').length;
    const rejected = state.candidates.filter((item) => item.reviewStatus === 'rejected').length;
    const promoted = state.candidates.filter((item) => item.promotedLeadId).length;
    const average = total ? Math.round(state.candidates.reduce((sum, item) => sum + Number(item.finalScore || 0), 0) / total) : 0;
    return { total, pending, approved, rejected, promoted, average };
  };

  const filteredCandidates = () => {
    const filters = state.filters;
    const query = filters.query.trim().toLowerCase();
    const [scoreMin, scoreMax] = scoreRange(filters.score);
    return state.candidates.filter((candidate) => {
      const haystack = [candidate.name, candidate.company, candidate.city, candidate.state, candidate.sourceName, candidate.source, candidate.franchiseModel].join(' ').toLowerCase();
      return (!query || haystack.includes(query))
        && (!filters.city || candidate.city === filters.city)
        && (!filters.state || candidate.state === filters.state)
        && (!filters.reviewStatus || candidate.reviewStatus === filters.reviewStatus)
        && (!filters.score || (candidate.finalScore >= scoreMin && candidate.finalScore <= scoreMax))
        && (!filters.franchiseModel || candidate.franchiseModel === filters.franchiseModel)
        && (!filters.source || (candidate.sourceName || candidate.source) === filters.source)
        && (!filters.enrichmentStatus || candidate.enrichmentStatus === filters.enrichmentStatus)
        && (!filters.promoted || (filters.promoted === 'yes' ? Boolean(candidate.promotedLeadId) : !candidate.promotedLeadId));
    });
  };

  const optionList = (values, selected, placeholder) => `<option value="">${esc(placeholder)}</option>${values.map((value) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(value)}</option>`).join('')}`;

  const toolbar = () => {
    const cities = unique(state.candidates.map((item) => item.city));
    const states = unique(state.candidates.map((item) => item.state));
    const models = unique(state.candidates.map((item) => item.franchiseModel));
    const sources = unique(state.candidates.map((item) => item.sourceName || item.source));
    return `<section class="pmh-hunter-toolbar" aria-label="Filtros do Caça Lead">
      <input type="search" placeholder="Buscar nome, empresa, cidade ou origem" value="${esc(state.filters.query)}" data-hunter-filter="query" />
      <select data-hunter-filter="city">${optionList(cities, state.filters.city, 'Todas as cidades')}</select>
      <select data-hunter-filter="state">${optionList(states, state.filters.state, 'Todos os estados')}</select>
      <select data-hunter-filter="reviewStatus"><option value="">Todos os status</option><option value="pending" ${state.filters.reviewStatus === 'pending' ? 'selected' : ''}>Em revisão</option><option value="approved" ${state.filters.reviewStatus === 'approved' ? 'selected' : ''}>Aprovados</option><option value="rejected" ${state.filters.reviewStatus === 'rejected' ? 'selected' : ''}>Rejeitados</option></select>
      <select data-hunter-filter="score"><option value="">Todos os scores</option><option value="high" ${state.filters.score === 'high' ? 'selected' : ''}>75 a 100</option><option value="medium" ${state.filters.score === 'medium' ? 'selected' : ''}>50 a 74</option><option value="low" ${state.filters.score === 'low' ? 'selected' : ''}>0 a 49</option></select>
      <select data-hunter-filter="franchiseModel">${optionList(models, state.filters.franchiseModel, 'Todos os modelos')}</select>
      <select data-hunter-filter="source">${optionList(sources, state.filters.source, 'Todas as origens')}</select>
      <select data-hunter-filter="enrichmentStatus"><option value="">Todo enriquecimento</option><option value="pending" ${state.filters.enrichmentStatus === 'pending' ? 'selected' : ''}>Pendente</option><option value="processing" ${state.filters.enrichmentStatus === 'processing' ? 'selected' : ''}>Processando</option><option value="completed" ${state.filters.enrichmentStatus === 'completed' ? 'selected' : ''}>Concluído</option><option value="failed" ${state.filters.enrichmentStatus === 'failed' ? 'selected' : ''}>Falhou</option></select>
      <select data-hunter-filter="promoted"><option value="">Promovidos e não promovidos</option><option value="yes" ${state.filters.promoted === 'yes' ? 'selected' : ''}>Somente promovidos</option><option value="no" ${state.filters.promoted === 'no' ? 'selected' : ''}>Ainda não promovidos</option></select>
    </section>`;
  };

  const reasonGroups = (candidate) => {
    const reasons = Array.isArray(candidate.scoreReasons) ? candidate.scoreReasons : [];
    return {
      positive: reasons.filter((item) => item.startsWith('Positivo:')),
      risks: reasons.filter((item) => item.startsWith('Risco:')),
      missing: reasons.filter((item) => item.startsWith('Ausente:')),
    };
  };
  const listItems = (items, fallback) => `<ul>${items.length ? items.map((item) => `<li>${esc(item.replace(/^[^:]+:\s*/, ''))}</li>`).join('') : `<li>${esc(fallback)}</li>`}</ul>`;
  const evidenceClass = (type) => {
    const value = String(type || '').toLowerCase();
    if (value.includes('fact') || value.includes('confirm')) return 'fact';
    if (value.includes('infer')) return 'inference';
    return 'clue';
  };
  const evidenceLabel = (type) => ({ fact: 'Fato confirmado', inference: 'Inferência', clue: 'Indício' }[evidenceClass(type)]);

  const details = (candidate) => {
    const groups = reasonGroups(candidate);
    const evidences = Array.isArray(candidate.evidences) ? candidate.evidences : [];
    return `<section class="pmh-hunter-details">
      <article class="pmh-hunter-detail-block"><h4>Por que este candidato?</h4>${listItems(groups.positive, 'Ainda não há argumento positivo registrado.')}</article>
      <article class="pmh-hunter-detail-block"><h4>Por que a Planet?</h4><ul><li>Aderência Planet: ${esc(candidate.planetFitScore)}/100.</li><li>Modelo sugerido: ${esc(candidate.franchiseModel || 'não informado')}.</li></ul></article>
      <article class="pmh-hunter-detail-block"><h4>Por que agora?</h4><ul><li>Intenção ou momento: ${esc(candidate.intentScore)}/100.</li><li>${esc(groups.positive.find((item) => /inten|momento/i.test(item))?.replace(/^[^:]+:\s*/, '') || 'O momento ainda precisa ser confirmado na abordagem.')}</li></ul></article>
      <article class="pmh-hunter-detail-block"><h4>Qual o risco?</h4>${listItems([...groups.risks, ...groups.missing], 'Nenhum risco relevante registrado.')}</article>
      <article class="pmh-hunter-detail-block"><h4>Quais dados estão faltando?</h4>${listItems(groups.missing, 'Os dados essenciais estão preenchidos.')}</article>
      <article class="pmh-hunter-detail-block"><h4>De onde vieram os dados?</h4><div class="pmh-hunter-evidence">${evidences.length ? evidences.map((evidence) => `<article class="${evidenceClass(evidence.type)}"><b>${evidenceLabel(evidence.type)} · ${esc(evidence.confidence)}%</b><span>${esc(evidence.description)}</span>${evidence.sourceUrl ? `<a href="${esc(evidence.sourceUrl)}" target="_blank" rel="noopener noreferrer">Abrir fonte</a>` : ''}</article>`).join('') : '<span>Nenhuma evidência estruturada anexada.</span>'}</div></article>
    </section>`;
  };

  const statusLabel = (candidate) => candidate.promotedLeadId ? 'Promovido' : ({ pending: 'Em revisão', approved: 'Aprovado', rejected: 'Rejeitado' }[candidate.reviewStatus] || 'Em revisão');
  const candidateCard = (candidate) => {
    const selected = state.selectedId === candidate.id;
    const bestEvidence = candidate.evidences?.slice().sort((a, b) => b.confidence - a.confidence)[0];
    const canPromote = candidate.reviewStatus === 'approved' && !candidate.promotedLeadId && (candidate.phone || candidate.email);
    return `<article class="pmh-hunter-card" data-candidate-id="${esc(candidate.id)}"><div class="pmh-hunter-card-main">
      <div><h3>${esc(candidate.name || candidate.company || 'Candidato sem nome')}</h3><p>${esc(candidate.company || 'Empresa não informada')} · ${esc([candidate.city, candidate.state].filter(Boolean).join('/') || 'Local não informado')}</p></div>
      <div><span class="pmh-hunter-score">${esc(candidate.finalScore)}<small>/100</small></span><p>Aderência ${esc(candidate.planetFitScore)} · Confiança ${esc(candidate.confidenceScore)}</p></div>
      <div><span class="pmh-hunter-chip ${esc(candidate.reviewStatus)}">${esc(statusLabel(candidate))}</span><p>${esc(candidate.franchiseModel || 'Modelo não informado')}</p></div>
      <div><strong>${esc(candidate.sourceName || candidate.source)}</strong><p>${esc(bestEvidence?.description || 'Sem evidência destacada')}</p></div>
      <div class="pmh-hunter-card-actions"><button class="pmh-hunter-button" type="button" data-hunter-details="${esc(candidate.id)}">${selected ? 'Fechar detalhes' : 'Ver detalhes'}</button>${candidate.reviewStatus === 'pending' ? `<button class="pmh-hunter-button" type="button" data-hunter-approve="${esc(candidate.id)}">Aprovar</button><button class="pmh-hunter-button danger" type="button" data-hunter-reject="${esc(candidate.id)}">Descartar</button>` : ''}${canPromote ? `<button class="pmh-hunter-button primary" type="button" data-hunter-promote="${esc(candidate.id)}">Promover para Leads</button>` : ''}${candidate.promotedLeadId ? `<button class="pmh-hunter-button primary" type="button" data-hunter-open-lead="${esc(candidate.promotedLeadId)}">Abrir lead</button>` : ''}</div>
    </div>${selected ? details(candidate) : ''}</article>`;
  };

  const automationPanel = () => {
    const status = state.huntStatus;
    const run = status?.lastRun || null;
    const report = state.huntReport;
    const locations = Array.isArray(status?.locations) && status.locations.length
      ? status.locations.map((item) => `${item.city}${item.state ? `/${item.state}` : ''}`).join(', ')
      : 'Joinville/SC';
    const runStatus = ({ completed: 'Concluída', partial: 'Concluída com alertas', failed: 'Falhou', running: 'Em andamento' }[run?.status] || 'Ainda não executada');
    return `<section class="pmh-hunter-import pmh-hunter-automation"><div><small>BUSCA AUTOMÁTICA</small><h3>${esc(runStatus)}</h3><p>Praça piloto: ${esc(locations)} · Última execução: ${esc(fmtDateTime(run?.completedAt || run?.startedAt))}.</p><p>${run ? `${esc(run.candidatesCreated || 0)} novos · ${esc(run.duplicates || 0)} duplicados · ${esc(run.withoutContact || 0)} sem contato.` : 'O robô ainda não realizou a primeira varredura.'}</p>${report ? `<p><strong>Última busca manual:</strong> ${esc(report.placesFound || 0)} estabelecimentos encontrados, ${esc(report.candidatesCreated || 0)} candidatos criados.</p>` : ''}<p><a href="${OSM_LICENSE_URL}" target="_blank" rel="noopener noreferrer">${esc(status?.attribution || '© OpenStreetMap contributors')}</a></p></div></section>`;
  };

  const importPanel = () => {
    if (!state.importPreview && !state.importReport) return '';
    if (state.importReport) {
      const report = state.importReport;
      return `<section class="pmh-hunter-import"><h3>Relatório da importação</h3><p>${esc(report.linesRead)} linhas lidas · ${esc(report.candidatesCreated)} candidatos criados · ${esc(report.duplicates)} duplicados · ${esc(report.invalid)} inválidos · ${esc(report.withoutContact)} sem contato.</p><div><button class="pmh-hunter-button" type="button" data-hunter-import-close>Fechar relatório</button></div></section>`;
    }
    const rows = state.importPreview.items.slice(0, 8);
    return `<section class="pmh-hunter-import"><h3>Prévia antes de importar</h3><p>${esc(state.importPreview.items.length)} registros lidos de <strong>${esc(state.importPreview.fileName)}</strong>.</p><div class="pmh-hunter-preview"><table><thead><tr><th>Nome</th><th>Empresa</th><th>Contato</th><th>Cidade</th><th>Origem</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${esc(item.name)}</td><td>${esc(item.company)}</td><td>${esc(item.phone || item.email || 'Sem contato')}</td><td>${esc([item.city, item.state].filter(Boolean).join('/'))}</td><td>${esc(item.sourceName || item.source)}</td></tr>`).join('')}</tbody></table></div><div class="pmh-hunter-head-actions"><button class="pmh-hunter-button" type="button" data-hunter-import-cancel>Cancelar</button><button class="pmh-hunter-button primary" type="button" data-hunter-import-confirm ${state.importing ? 'disabled' : ''}>${state.importing ? 'Importando…' : 'Confirmar importação'}</button></div></section>`;
  };

  const renderHunter = () => {
    const target = root();
    if (!target || target.hidden) return;
    const values = metrics();
    const candidates = filteredCandidates();
    target.innerHTML = `<section class="pmh-hunter"><header class="pmh-hunter-head"><div><small>PLANET CHOCOLATE · EXPANSÃO</small><h2>Caça Lead</h2><p>O robô encontra operações públicas, organiza as evidências e entrega candidatos para sua revisão.</p></div><div class="pmh-hunter-head-actions"><button class="pmh-hunter-button primary" type="button" data-hunter-hunt ${state.hunting ? 'disabled' : ''}>${state.hunting ? 'Buscando…' : '⌖ Buscar agora'}</button><button class="pmh-hunter-button" type="button" data-hunter-refresh ${state.loading ? 'disabled' : ''}>${state.loading ? 'Atualizando…' : '↻ Atualizar'}</button><button class="pmh-hunter-button" type="button" data-hunter-import>Importar arquivo</button><input type="file" accept=".csv,.json,text/csv,application/json" data-hunter-file hidden /></div></header>
      <section class="pmh-hunter-metrics"><article><small>TOTAL</small><strong>${values.total}</strong></article><article><small>EM REVISÃO</small><strong>${values.pending}</strong></article><article><small>APROVADOS</small><strong>${values.approved}</strong></article><article><small>REJEITADOS</small><strong>${values.rejected}</strong></article><article><small>PROMOVIDOS</small><strong>${values.promoted}</strong></article><article><small>SCORE MÉDIO</small><strong>${values.average}</strong></article></section>
      ${state.notice && !state.error ? `<div class="pmh-hunter-notice">${esc(state.notice)}</div>` : ''}${state.error ? `<div class="pmh-hunter-error">${esc(state.error)}</div>` : ''}${automationPanel()}${importPanel()}${toolbar()}<section class="pmh-hunter-list">${state.loading && !state.loaded ? '<div class="pmh-hunter-empty">Carregando candidatos…</div>' : candidates.length ? candidates.map(candidateCard).join('') : '<div class="pmh-hunter-empty">Nenhum candidato corresponde aos filtros atuais.</div>'}</section></section>`;
  };

  const activateHunter = () => {
    const target = root();
    if (!target || target.hidden) return;
    renderHunter();
    if (!state.loaded && !state.loading) load();
  };

  const scheduleRender = () => {
    if (renderFrame) cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      activateHunter();
    });
  };

  const updateCandidate = async (id, changes) => {
    const payload = await requestJson(`${API}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ changes }) });
    state.candidates = state.candidates.map((item) => item.id === id ? payload.candidate : item);
    renderHunter();
    return payload.candidate;
  };
  const approveCandidate = async (id) => {
    try { await updateCandidate(id, { reviewStatus: 'approved', reviewedBy: 'André OS' }); showNotice('Candidato aprovado para promoção.'); }
    catch (error) { showNotice(error instanceof Error ? error.message : String(error), 'error'); }
  };
  const rejectCandidate = async (id) => {
    const reason = window.prompt('Informe o motivo do descarte:');
    if (!reason?.trim()) return;
    try { await updateCandidate(id, { reviewStatus: 'rejected', reviewedBy: 'André OS', discardReason: reason }); showNotice('Candidato descartado com motivo registrado.'); }
    catch (error) { showNotice(error instanceof Error ? error.message : String(error), 'error'); }
  };
  const openLead = (leadId) => {
    if (!leadId) return;
    window.dispatchEvent(new CustomEvent('planet:open-lead', { detail: { leadId } }));
  };
  const promoteCandidate = async (id) => {
    try {
      const payload = await requestJson(`${API}/${encodeURIComponent(id)}/promote`, { method: 'POST' });
      if (payload.candidate) state.candidates = state.candidates.map((item) => item.id === id ? payload.candidate : item);
      showNotice(payload.idempotent ? 'Este candidato já estava promovido.' : 'Candidato promovido para Leads.');
      window.setTimeout(() => openLead(payload.leadId), 250);
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), 'error'); }
  };
  const runHunt = async () => {
    if (state.hunting) return;
    state.hunting = true;
    state.error = '';
    renderHunter();
    try {
      const payload = await requestJson(HUNT_API, { method: 'POST', body: '{}' });
      state.huntReport = payload.report || null;
      if (payload.run) {
        state.huntStatus = { ...(state.huntStatus || {}), lastRun: payload.run, attribution: payload.run.attribution || state.huntStatus?.attribution };
      }
      await load({ silent: true });
      const created = Number(payload.report?.candidatesCreated || 0);
      const duplicates = Number(payload.report?.duplicates || 0);
      showNotice(`Busca concluída: ${created} novos e ${duplicates} duplicados.`);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      state.hunting = false;
      renderHunter();
    }
  };

  const normalizeHeader = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const FIELD_ALIASES = {
    name: ['name', 'nome', 'contato'], company: ['company', 'empresa', 'negocio'], phone: ['phone', 'telefone', 'celular', 'whatsapp'], email: ['email', 'mail'], city: ['city', 'cidade'], state: ['state', 'estado', 'uf'], source: ['source', 'origemcodigo'], sourceName: ['sourcename', 'origem', 'fonte'], sourceRecordId: ['sourcerecordid', 'externalid', 'idexterno'], sourceUrl: ['sourceurl', 'url', 'link'], franchiseModel: ['franchisemodel', 'modelo', 'modeloplanet'], reviewNotes: ['reviewnotes', 'notas', 'observacoes'],
  };
  const delimiterFromHeader = (text) => {
    const line = String(text || '').split(/\r?\n/, 1)[0] || '';
    const counts = [[',', (line.match(/,/g) || []).length], [';', (line.match(/;/g) || []).length], ['\t', (line.match(/\t/g) || []).length]];
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] ? counts[0][0] : ',';
  };
  const parseCsvRows = (text, delimiter = ',') => {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { row.push(cell); cell = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index += 1;
        row.push(cell); cell = '';
        if (row.some((value) => value.trim())) rows.push(row);
        row = [];
      } else cell += char;
    }
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
    return rows;
  };
  const csvToCandidates = (text) => {
    const rows = parseCsvRows(text, delimiterFromHeader(text));
    if (rows.length < 2) throw new Error('O CSV precisa ter cabeçalho e pelo menos uma linha.');
    const headers = rows[0].map(normalizeHeader);
    const mapping = {};
    Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
      const index = headers.findIndex((header) => aliases.includes(header));
      if (index >= 0) mapping[field] = index;
    });
    return rows.slice(1).map((row) => {
      const candidate = { source: 'manual_import', sourceName: 'Importação CSV' };
      Object.entries(mapping).forEach(([field, column]) => { candidate[field] = row[column]?.trim() || ''; });
      return candidate;
    });
  };
  const readImportFile = async (file) => {
    const text = await file.text();
    if (file.name.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.candidates || parsed.data;
      if (!Array.isArray(items)) throw new Error('O JSON precisa conter uma lista de candidatos.');
      return items;
    }
    return csvToCandidates(text);
  };
  const handleFile = async (file) => {
    try {
      const items = await readImportFile(file);
      state.importPreview = { fileName: file.name, items: items.slice(0, 500) };
      state.importReport = null;
      state.error = '';
      renderHunter();
    } catch (error) { showNotice(error instanceof Error ? error.message : String(error), 'error'); }
  };
  const confirmImport = async () => {
    if (!state.importPreview || state.importing) return;
    state.importing = true;
    renderHunter();
    try {
      const payload = await requestJson(IMPORT_API, { method: 'POST', body: JSON.stringify({ candidates: state.importPreview.items }) });
      state.importReport = payload.report || null;
      state.importPreview = null;
      state.importing = false;
      await load({ silent: true });
    } catch (error) {
      state.importing = false;
      showNotice(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      state.importing = false;
      renderHunter();
    }
  };

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-lead-hunter-root]')) return;
    if (event.target.closest('[data-hunter-hunt]')) runHunt();
    if (event.target.closest('[data-hunter-refresh]')) load();
    const detailsButton = event.target.closest('[data-hunter-details]');
    if (detailsButton) { state.selectedId = state.selectedId === detailsButton.dataset.hunterDetails ? '' : detailsButton.dataset.hunterDetails; renderHunter(); }
    const approve = event.target.closest('[data-hunter-approve]');
    if (approve) approveCandidate(approve.dataset.hunterApprove);
    const reject = event.target.closest('[data-hunter-reject]');
    if (reject) rejectCandidate(reject.dataset.hunterReject);
    const promote = event.target.closest('[data-hunter-promote]');
    if (promote) promoteCandidate(promote.dataset.hunterPromote);
    const open = event.target.closest('[data-hunter-open-lead]');
    if (open) openLead(open.dataset.hunterOpenLead);
    if (event.target.closest('[data-hunter-import]')) root()?.querySelector('[data-hunter-file]')?.click();
    if (event.target.closest('[data-hunter-import-cancel]')) { state.importPreview = null; renderHunter(); }
    if (event.target.closest('[data-hunter-import-close]')) { state.importReport = null; renderHunter(); }
    if (event.target.closest('[data-hunter-import-confirm]')) confirmImport();
  }, true);
  document.addEventListener('input', (event) => {
    const filter = event.target.closest?.('[data-hunter-filter]');
    if (!filter) return;
    state.filters[filter.dataset.hunterFilter] = filter.value;
    renderHunter();
  });
  document.addEventListener('change', (event) => {
    const filter = event.target.closest?.('[data-hunter-filter]');
    if (filter) { state.filters[filter.dataset.hunterFilter] = filter.value; renderHunter(); }
    const file = event.target.closest?.('[data-hunter-file]');
    if (file?.files?.[0]) { handleFile(file.files[0]); file.value = ''; }
  });

  window.addEventListener('planet:expansion-section-rendered', (event) => {
    if (event.detail?.section === 'caca-lead') scheduleRender();
  });
  window.addEventListener('planet:open-candidate', (event) => {
    state.selectedId = String(event.detail?.candidateId || '');
    scheduleRender();
  });
  window.addEventListener('pmh:access-ready', scheduleRender);

  window.PlanetLeadHunter = {
    load,
    hunt: runHunt,
    render: scheduleRender,
    openCandidate(id) {
      window.dispatchEvent(new CustomEvent('planet:open-candidate', {
        detail: { candidateId: id },
      }));
    },
  };
  scheduleRender();
})();