(() => {
  'use strict';

  const API = '/api/hub/campanhas';
  const LOCAL_KEY = 'planet-hub-campaign-operations-v1';
  const STATUS = {
    planejamento: 'Planejamento',
    producao: 'Em produção',
    aprovacao: 'Em aprovação',
    ativa: 'Ativa',
    concluida: 'Concluída',
  };

  const state = {
    campaigns: [],
    operations: new Map(),
    revision: null,
    shared: false,
    mount: null,
    head: null,
    loading: false,
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const parseBrDate = (value) => {
    const match = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return '';
    return `${match[3]}-${match[2]}-${match[1]}`;
  };

  const asDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const today = () => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  };

  const fmtDate = (value) => {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Sem data';
  };

  const daysFromToday = (value) => {
    const date = asDate(value);
    if (!date) return null;
    return Math.round((date.getTime() - today().getTime()) / 86400000);
  };

  const civilDayNumber = (year, month, day) => Math.floor(Date.UTC(year, month, day) / 86400000);

  const milestoneDayNumber = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return civilDayNumber(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };

  const localDayNumber = (reference = new Date()) => civilDayNumber(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );

  const milestoneAttention = (operation, reference = new Date()) => {
    if (!operation || operation.status === 'concluida' || !operation.milestoneDate) return null;
    const milestoneDay = milestoneDayNumber(operation.milestoneDate);
    if (milestoneDay == null) return null;
    const days = milestoneDay - localDayNumber(reference);
    if (days < 0) {
      const elapsed = Math.abs(days);
      return {
        kind: 'overdue',
        label: 'MARCO ATRASADO',
        detail: `${elapsed} ${elapsed === 1 ? 'dia' : 'dias'} em atraso`,
        days,
        date: operation.milestoneDate,
      };
    }
    if (days === 0) {
      return { kind: 'today', label: 'MARCO HOJE', detail: 'vence hoje', days, date: operation.milestoneDate };
    }
    if (days <= 7) {
      return {
        kind: 'upcoming',
        label: 'PRÓXIMO MARCO',
        detail: `em ${days} ${days === 1 ? 'dia' : 'dias'}`,
        days,
        date: operation.milestoneDate,
      };
    }
    return null;
  };

  const attentionRank = (kind) => ({ overdue: 0, today: 1, upcoming: 2 }[kind] ?? 9);

  const sortAttentionItems = (a, b) => {
    const rank = attentionRank(a.attention.kind) - attentionRank(b.attention.kind);
    if (rank !== 0) return rank;
    return String(a.attention.date).localeCompare(String(b.attention.date));
  };

  const campaignId = (campaign) => `${campaign.start}__${normalize(campaign.name)}`;

  const parseCampaigns = (calendar) => {
    const types = ['principal', 'apoio', 'data', 'institucional'];
    const campaigns = [];

    calendar.querySelectorAll(':scope > section').forEach((section) => {
      section.querySelectorAll('article').forEach((article) => {
        const dateText = article.querySelector('small')?.textContent || '';
        const matches = [...dateText.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((item) => parseBrDate(item[0]));
        const start = matches[0] || '';
        const end = matches[1] || start;
        const type = types.find((item) => article.classList.contains(item)) || 'data';
        const campaign = {
          start,
          end,
          type,
          name: article.querySelector('h4')?.textContent?.trim() || 'Campanha sem nome',
          note: article.querySelector('p')?.textContent?.trim() || '',
        };
        campaign.id = campaignId(campaign);
        campaigns.push(campaign);
      });
    });

    return campaigns.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  };

  const defaultStatus = (campaign) => {
    const now = today();
    const start = asDate(campaign.start);
    const end = asDate(campaign.end || campaign.start);
    if (end && end < now) return 'concluida';
    if (start && end && start <= now && end >= now) return 'ativa';
    return 'planejamento';
  };

  const operationFor = (campaign) => state.operations.get(campaign.id) || {
    id: campaign.id,
    status: defaultStatus(campaign),
    responsible: '',
    nextMilestone: '',
    milestoneDate: '',
    materials: '',
    notes: '',
  };

  const readLocal = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeLocal = () => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...state.operations.values()]));
  };

  const loadOperations = async () => {
    const local = readLocal();
    state.operations = new Map(local.filter((item) => item?.id).map((item) => [item.id, item]));

    try {
      const response = await fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      state.operations = new Map((payload.data || []).filter((item) => item?.id).map((item) => [item.id, item]));
      state.revision = payload.revision || null;
      state.shared = true;
      writeLocal();
    } catch {
      state.shared = false;
    }
  };

  const saveOperation = async (operation, retry = true) => {
    state.operations.set(operation.id, operation);
    writeLocal();

    try {
      const response = await fetch(API, {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [...state.operations.values()], baseRevision: state.revision }),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 409 && retry) {
        const remote = new Map((payload.data || []).filter((item) => item?.id).map((item) => [item.id, item]));
        remote.set(operation.id, operation);
        state.operations = remote;
        state.revision = payload.revision || null;
        return saveOperation(operation, false);
      }
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);

      state.operations = new Map((payload.data || []).filter((item) => item?.id).map((item) => [item.id, item]));
      state.revision = payload.revision || null;
      state.shared = true;
      writeLocal();
      return true;
    } catch (error) {
      state.shared = false;
      throw error;
    }
  };

  const typeLabel = (type) => ({
    principal: 'Principal',
    apoio: 'Apoio',
    data: 'Data comemorativa',
    institucional: 'Institucional',
  }[type] || 'Campanha');

  const periodLabel = (campaign) => campaign.start === campaign.end
    ? fmtDate(campaign.start)
    : `${fmtDate(campaign.start)} → ${fmtDate(campaign.end)}`;

  const relativeStart = (campaign) => {
    const days = daysFromToday(campaign.start);
    if (days == null) return 'Sem contagem';
    if (days < 0) return `Começou há ${Math.abs(days)} ${Math.abs(days) === 1 ? 'dia' : 'dias'}`;
    if (days === 0) return 'Começa hoje';
    if (days === 1) return 'Começa amanhã';
    return `Começa em ${days} dias`;
  };

  const renderStatus = (status) => `<span class="pmh-campaign-status status-${esc(status)}">${esc(STATUS[status] || STATUS.planejamento)}</span>`;

  const renderAttentionBadge = (operation, compact = false) => {
    const attention = milestoneAttention(operation);
    if (!attention) return '';
    return `<span class="pmh-campaign-attention-badge attention-${esc(attention.kind)}"><b>${esc(attention.label)}</b>${compact ? '' : `<small>${esc(attention.detail)}</small>`}</span>`;
  };

  const renderFocusCard = (campaign, role) => {
    if (!campaign) {
      return `<article class="pmh-campaign-focus-card empty"><small>${esc(role)}</small><h3>Nenhuma campanha encontrada</h3><p>O calendário não possui uma campanha para este período.</p></article>`;
    }
    const operation = operationFor(campaign);
    return `<button type="button" class="pmh-campaign-focus-card ${esc(campaign.type)}" data-edit-campaign="${esc(campaign.id)}">
      <small>${esc(role)}</small>
      <div class="pmh-campaign-focus-head"><h3>${esc(campaign.name)}</h3><div class="pmh-campaign-focus-signals">${renderStatus(operation.status)}${renderAttentionBadge(operation)}</div></div>
      <p>${esc(campaign.note || 'Sem observações gerais.')}</p>
      <footer><span>${esc(periodLabel(campaign))}</span><b>${esc(relativeStart(campaign))}</b></footer>
      ${operation.responsible ? `<em>Responsável: ${esc(operation.responsible)}</em>` : '<em>Responsável ainda não definido</em>'}
    </button>`;
  };

  const renderTimelineCard = (campaign) => {
    const operation = operationFor(campaign);
    return `<button type="button" class="pmh-campaign-timeline-card ${esc(campaign.type)}" data-edit-campaign="${esc(campaign.id)}">
      <div class="pmh-campaign-date-block"><strong>${esc(fmtDate(campaign.start).slice(0, 5))}</strong><span>${esc(relativeStart(campaign))}</span></div>
      <div class="pmh-campaign-timeline-main">
        <div><small>${esc(typeLabel(campaign.type))}</small><h4>${esc(campaign.name)}</h4><p>${esc(campaign.note)}</p></div>
        <div class="pmh-campaign-timeline-meta">${renderStatus(operation.status)}${renderAttentionBadge(operation, true)}<span>${esc(operation.responsible || 'Sem responsável')}</span></div>
      </div>
      <div class="pmh-campaign-next-step"><small>PRÓXIMO MARCO</small><strong>${esc(operation.nextMilestone || 'Ainda não definido')}</strong><span>${operation.milestoneDate ? esc(fmtDate(operation.milestoneDate)) : 'Sem data'}${milestoneAttention(operation) ? ` · ${esc(milestoneAttention(operation).detail)}` : ''}</span></div>
    </button>`;
  };

  const renderAnnualCard = (campaign) => {
    const operation = operationFor(campaign);
    const past = asDate(campaign.end) < today();
    return `<button type="button" class="pmh-campaign-annual-card ${esc(campaign.type)} ${past ? 'past' : ''}" data-edit-campaign="${esc(campaign.id)}">
      <small>${esc(periodLabel(campaign))}</small><h4>${esc(campaign.name)}</h4><p>${esc(campaign.note)}</p>
      <footer>${renderStatus(operation.status)}<span>${esc(operation.responsible || typeLabel(campaign.type))}</span></footer>
      ${renderAttentionBadge(operation, true)}
    </button>`;
  };

  const renderAttentionItem = ({ campaign, operation, attention }) => `<button type="button" class="pmh-campaign-attention-item attention-${esc(attention.kind)}" data-edit-campaign="${esc(campaign.id)}">
    <div><span>${esc(attention.label)}</span><strong>${esc(campaign.name)}</strong><small>${esc(operation.nextMilestone || 'Marco sem descrição')}</small></div>
    <div><strong>${esc(fmtDate(operation.milestoneDate))}</strong><span>${esc(attention.detail)}</span>${operation.responsible ? `<small>Responsável: ${esc(operation.responsible)}</small>` : ''}</div>
  </button>`;

  const renderMetric = (label, value, note, tone) => `<article class="pmh-campaign-metric ${tone}"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></article>`;

  const render = () => {
    if (!state.mount?.isConnected) return;
    const now = today();
    const plus60 = new Date(now);
    plus60.setDate(plus60.getDate() + 60);

    const active = state.campaigns.filter((campaign) => {
      const start = asDate(campaign.start);
      const end = asDate(campaign.end || campaign.start);
      return operationFor(campaign).status === 'ativa' || (start && end && start <= now && end >= now);
    });
    const future = state.campaigns.filter((campaign) => asDate(campaign.start) > now);
    const next = future[0] || null;
    const production = state.campaigns.filter((campaign) => operationFor(campaign).status === 'producao');
    const approval = state.campaigns.filter((campaign) => operationFor(campaign).status === 'aprovacao');
    const next60 = state.campaigns.filter((campaign) => {
      const start = asDate(campaign.start);
      const end = asDate(campaign.end || campaign.start);
      return start && end && end >= now && start <= plus60;
    });
    const attentionItems = state.campaigns
      .map((campaign) => {
        const operation = operationFor(campaign);
        return { campaign, operation, attention: milestoneAttention(operation) };
      })
      .filter((item) => item.attention)
      .sort(sortAttentionItems);
    const visibleAttention = attentionItems.slice(0, 6);

    const months = Array.from({ length: 12 }, (_, month) => state.campaigns.filter((campaign) => asDate(campaign.start)?.getMonth() === month));
    const nextNote = next ? relativeStart(next) : 'Nenhuma próxima campanha';

    if (state.head) {
      state.head.innerHTML = `<div><small>PLANEJAMENTO DE CAMPANHAS</small><h2>Calendário operacional</h2><p>O que está ativo, o que vem depois e em qual etapa cada campanha se encontra.</p></div><span class="pmh-campaign-storage"><i class="${state.shared ? 'shared' : 'local'}"></i>${state.shared ? 'Dados compartilhados' : 'Modo local'}</span>`;
    }

    state.mount.innerHTML = `
      <section class="pmh-campaign-metrics">
        ${renderMetric('Campanhas ativas', active.length, active[0]?.name || 'Nenhuma campanha ativa', 'green')}
        ${renderMetric('Próxima campanha', next ? next.name : '—', nextNote, 'purple')}
        ${renderMetric('Em produção', production.length, production[0]?.name || 'Nenhuma em produção', 'blue')}
        ${renderMetric('Em aprovação', approval.length, approval[0]?.name || 'Nenhuma em aprovação', 'orange')}
      </section>

      <section class="pmh-campaign-attention">
        <header><div><small>PRECISA DE ATENÇÃO</small><h3>Marcos que pedem ação agora</h3></div><span>${attentionItems.length} ${attentionItems.length === 1 ? 'campanha' : 'campanhas'}</span></header>
        <div>${visibleAttention.length ? visibleAttention.map(renderAttentionItem).join('') : '<div class="pmh-campaign-empty">Nenhum marco atrasado ou previsto para os próximos 7 dias.</div>'}</div>
        ${attentionItems.length > visibleAttention.length ? `<p>+${attentionItems.length - visibleAttention.length} campanha(s) com marco próximo.</p>` : ''}
      </section>

      <section class="pmh-campaign-focus">
        ${renderFocusCard(active[0] || null, 'CAMPANHA ATIVA')}
        ${renderFocusCard(next, 'PRÓXIMA CAMPANHA')}
      </section>

      <section class="pmh-campaign-timeline">
        <header><div><small>AGORA E PRÓXIMOS 60 DIAS</small><h3>Linha do tempo operacional</h3></div><span>${next60.length} campanhas no radar</span></header>
        <div>${next60.length ? next60.map(renderTimelineCard).join('') : '<div class="pmh-campaign-empty">Nenhuma campanha prevista para os próximos 60 dias.</div>'}</div>
      </section>

      <details class="pmh-campaign-annual" open>
        <summary><div><small>REFERÊNCIA ANUAL</small><strong>Calendário completo de 2026</strong></div><span>${state.campaigns.length} campanhas</span></summary>
        <div class="pmh-campaign-months">${months.map((items, month) => `<section><header><h3>${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, month, 1))}</h3><b>${items.length}</b></header><div>${items.length ? items.map(renderAnnualCard).join('') : '<p class="pmh-campaign-month-empty">Sem ações previstas.</p>'}</div></section>`).join('')}</div>
      </details>`;
  };

  const toast = (message, tone = 'success') => {
    document.querySelector('.pmh-campaign-toast')?.remove();
    const element = document.createElement('div');
    element.className = `pmh-campaign-toast ${tone}`;
    element.textContent = message;
    document.body.appendChild(element);
    requestAnimationFrame(() => element.classList.add('visible'));
    setTimeout(() => {
      element.classList.remove('visible');
      setTimeout(() => element.remove(), 220);
    }, 2600);
  };

  const closeModal = () => document.querySelector('.pmh-campaign-modal')?.remove();

  const openModal = (id) => {
    const campaign = state.campaigns.find((item) => item.id === id);
    if (!campaign) return;
    const operation = operationFor(campaign);
    closeModal();

    const modal = document.createElement('div');
    modal.className = 'pmh-campaign-modal';
    modal.innerHTML = `<section>
      <header><div><small>GESTÃO DA CAMPANHA</small><h2>${esc(campaign.name)}</h2><p>${esc(periodLabel(campaign))} · ${esc(typeLabel(campaign.type))}</p></div><button type="button" data-campaign-close>×</button></header>
      <form>
        <label>Status<select name="status">${Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${operation.status === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
        <label>Responsável<input name="responsible" maxlength="160" value="${esc(operation.responsible || '')}" placeholder="Ex.: André, Ágata ou agência"></label>
        <label class="wide">Próximo marco<input name="nextMilestone" maxlength="280" value="${esc(operation.nextMilestone || '')}" placeholder="Ex.: aprovar conceito, receber fotos ou publicar campanha"></label>
        <label>Data do próximo marco<input name="milestoneDate" type="date" value="${esc(operation.milestoneDate || '')}"></label>
        <label class="wide">Materiais vinculados<textarea name="materials" maxlength="900" placeholder="Liste links, peças, formatos ou arquivos necessários.">${esc(operation.materials || '')}</textarea></label>
        <label class="wide">Observações<textarea name="notes" maxlength="1200" placeholder="Decisões, pendências ou contexto importante.">${esc(operation.notes || '')}</textarea></label>
        <footer class="wide"><span>${state.shared ? 'As alterações serão compartilhadas.' : 'As alterações serão salvas neste navegador.'}</span><button type="button" data-campaign-close>Cancelar</button><button class="primary" type="submit">Salvar campanha</button></footer>
      </form>
    </section>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-campaign-close]').forEach((button) => button.addEventListener('click', closeModal));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      button.textContent = 'Salvando…';

      const updated = {
        id: campaign.id,
        status: String(form.get('status') || 'planejamento'),
        responsible: String(form.get('responsible') || '').trim(),
        nextMilestone: String(form.get('nextMilestone') || '').trim(),
        milestoneDate: String(form.get('milestoneDate') || ''),
        materials: String(form.get('materials') || '').trim(),
        notes: String(form.get('notes') || '').trim(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await saveOperation(updated);
        closeModal();
        render();
        toast(state.shared ? 'Campanha atualizada e compartilhada.' : 'Campanha salva neste navegador.');
      } catch (error) {
        button.disabled = false;
        button.textContent = 'Salvar campanha';
        toast(error instanceof Error ? error.message : 'Não foi possível salvar a campanha.', 'error');
      }
    });
  };

  const transform = async () => {
    const calendar = document.querySelector('.pmh-calendar');
    if (!calendar || calendar.dataset.operationsLoading === '1') return;
    const pageTitle = document.querySelector('[data-title]')?.textContent || '';
    if (!normalize(pageTitle).includes('calendario')) return;

    calendar.dataset.operationsLoading = '1';
    state.campaigns = parseCampaigns(calendar);
    state.head = document.querySelector('.pmh-section-head');

    const legend = calendar.previousElementSibling?.classList.contains('pmh-calendar-legend')
      ? calendar.previousElementSibling
      : null;
    const mount = document.createElement('section');
    mount.className = 'pmh-calendar-operations';
    mount.innerHTML = '<div class="pmh-campaign-loading">Organizando o calendário operacional…</div>';
    calendar.before(mount);
    legend?.remove();
    calendar.remove();
    state.mount = mount;

    state.loading = true;
    await loadOperations();
    state.loading = false;
    render();
  };

  document.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-campaign]');
    if (edit) {
      event.preventDefault();
      openModal(edit.dataset.editCampaign);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  const observer = new MutationObserver(transform);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  transform();
})();