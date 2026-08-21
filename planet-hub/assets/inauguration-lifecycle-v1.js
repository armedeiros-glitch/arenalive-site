(() => {
  'use strict';

  const API_URL = '/api/hub/inauguracoes-status';
  const TRACKED_KEY = 'planet-hub-inaugurations-v2';
  const statusById = new Map();
  let loading = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const ensureStyles = () => {
    if (document.querySelector('style[data-inauguration-lifecycle]')) return;
    const style = document.createElement('style');
    style.dataset.inaugurationLifecycle = '1';
    style.textContent = `
      .pmh-inauguration-end{min-height:36px;padding:0 12px;border:1px solid color-mix(in srgb,var(--os-success,#2f9e62) 34%,var(--os-border));border-radius:10px;color:var(--os-success,#2f9e62);background:var(--os-surface);font-size:11px;font-weight:900;cursor:pointer}
      .pmh-inauguration-history{margin-top:16px;border:1px solid var(--os-border);border-radius:14px;background:var(--os-surface)}
      .pmh-inauguration-history>summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;color:var(--os-text-muted);font-size:12px;font-weight:900;cursor:pointer;list-style:none}
      .pmh-inauguration-history>summary::-webkit-details-marker{display:none}
      .pmh-inauguration-history>summary b{padding:3px 7px;border-radius:999px;background:var(--os-surface-subtle);font-size:10px}
      .pmh-inauguration-history-list{display:grid;gap:8px;padding:0 12px 12px}
      .pmh-inauguration-history-card{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:11px 12px;border:1px solid var(--os-border);border-radius:11px;background:var(--os-surface-subtle)}
      .pmh-inauguration-history-card strong,.pmh-inauguration-history-card small{display:block}.pmh-inauguration-history-card strong{color:var(--os-text);font-size:12px}.pmh-inauguration-history-card small{margin-top:3px;color:var(--os-text-faint);font-size:10px}
      .pmh-inauguration-history-card>span{color:var(--os-text-muted);font-size:10px;white-space:nowrap}
      .pmh-inauguration-history-card button{min-height:32px;padding:0 10px;border:1px solid var(--os-border);border-radius:9px;color:var(--os-text-muted);background:var(--os-surface);font-size:10px;font-weight:850;cursor:pointer}
      @media(max-width:820px){.pmh-inauguration-history-card{grid-template-columns:1fr}.pmh-inauguration-history-card>span{white-space:normal}}
    `;
    document.head?.appendChild(style);
  };

  const readItems = () => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  };

  const parseDate = (value) => {
    if (!value) return null;
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const today = () => {
    const value = new Date();
    value.setHours(12, 0, 0, 0);
    return value;
  };

  const fmtDate = (value) => {
    const date = parseDate(value);
    return date ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Sem data';
  };

  const statusFor = (id) => statusById.get(String(id || '')) || null;
  const autoArchived = (item) => {
    const opening = parseDate(item?.openingDate);
    return Boolean(opening && opening.getTime() < today().getTime());
  };
  const isArchived = (item) => {
    const status = statusFor(item?.id);
    if (status?.state === 'closed') return true;
    if (status?.state === 'open') return false;
    return autoArchived(item);
  };

  const effectiveDue = (item, step) => {
    if (step?.dueDate) return parseDate(step.dueDate);
    const opening = parseDate(item?.openingDate);
    if (!opening || !Number.isFinite(Number(step?.daysBefore))) return null;
    opening.setDate(opening.getDate() - Number(step.daysBefore));
    return opening;
  };

  const loadStatuses = async (force = false) => {
    if (loading && !force) return loading;
    loading = fetch(API_URL, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Falha ao carregar status das inaugurações.');
        statusById.clear();
        (Array.isArray(payload.data) ? payload.data : []).forEach((item) => {
          if (item?.id) statusById.set(String(item.id), item);
        });
      })
      .catch((error) => console.warn('André OS: histórico de inaugurações indisponível', error))
      .finally(() => { loading = null; });
    return loading;
  };

  const saveStatus = async (id, state, reason) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, state, reason }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível atualizar a inauguração.');
    statusById.clear();
    (Array.isArray(payload.data) ? payload.data : []).forEach((item) => {
      if (item?.id) statusById.set(String(item.id), item);
    });
  };

  const setMetric = (label, value, note = '') => {
    document.querySelectorAll('.pmh-metrics .pmh-metric').forEach((metric) => {
      if ((metric.querySelector('small')?.textContent || '').trim() !== label) return;
      const strong = metric.querySelector('strong');
      const span = metric.querySelector('span');
      if (strong) strong.textContent = String(value);
      if (span && note) span.textContent = note;
    });
  };

  const renderHistory = (tracked, archived) => {
    tracked.querySelector('[data-inauguration-history]')?.remove();
    if (!archived.length) return;

    const history = document.createElement('details');
    history.className = 'pmh-inauguration-history';
    history.dataset.inaugurationHistory = '1';
    history.innerHTML = `
      <summary><span>Histórico de inaugurações</span><b>${archived.length}</b></summary>
      <div class="pmh-inauguration-history-list">
        ${archived.map((item) => {
          const status = statusFor(item.id);
          const reason = status?.state === 'closed' ? 'Encerrada manualmente' : `Data da inauguração: ${fmtDate(item.openingDate)}`;
          return `<article class="pmh-inauguration-history-card">
            <div><strong>${esc(item.unit || 'Unidade sem nome')}</strong><small>${esc(reason)}</small></div>
            <span>${esc(fmtDate(item.openingDate))}</span>
            <button type="button" data-inauguration-reopen="${esc(item.id)}">Reabrir acompanhamento</button>
          </article>`;
        }).join('')}
      </div>`;
    tracked.appendChild(history);
  };

  const ensureEndButton = () => {
    const detail = document.querySelector('[data-inauguration-browser-detail]:not([hidden])');
    const head = detail?.querySelector('.pmh-inauguration-project-detail-head');
    const itemId = String(detail?.querySelector('.pmh-inauguration-card')?.dataset.inaugurationProjectId || '');
    if (!head || !itemId || isArchived(readItems().find((item) => String(item?.id) === itemId))) return;
    if (head.querySelector('[data-inauguration-end]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pmh-inauguration-end';
    button.dataset.inaugurationEnd = itemId;
    button.textContent = 'Encerrar inauguração';
    head.appendChild(button);
  };

  const apply = () => {
    if (!window.location.hash.includes('inaugur')) return;
    ensureStyles();
    const items = readItems();
    const archived = items.filter(isArchived).sort((a, b) => (parseDate(b.openingDate)?.getTime() || 0) - (parseDate(a.openingDate)?.getTime() || 0));
    const active = items.filter((item) => !isArchived(item));
    const archivedIds = new Set(archived.map((item) => String(item.id)));

    document.querySelectorAll('[data-inauguration-open]').forEach((row) => {
      row.hidden = archivedIds.has(String(row.dataset.inaugurationOpen || ''));
    });
    document.querySelectorAll('.pmh-inauguration-card[data-inauguration-project-id]').forEach((card) => {
      card.hidden = archivedIds.has(String(card.dataset.inaugurationProjectId || ''));
    });

    const browser = document.querySelector('[data-inauguration-browser-root]');
    const visibleRows = browser ? [...browser.querySelectorAll('[data-inauguration-open]')].filter((row) => !row.hidden) : [];
    const listHeaderCount = browser?.querySelector('[data-inauguration-browser-list] > header > span');
    if (listHeaderCount) listHeaderCount.textContent = `${visibleRows.length} projeto${visibleRows.length === 1 ? '' : 's'}`;

    const badge = document.querySelector('[data-badge="inaugurations"]');
    if (badge) badge.textContent = String(active.length);
    const upcoming = active.filter((item) => {
      const opening = parseDate(item.openingDate);
      if (!opening) return false;
      const days = Math.ceil((opening.getTime() - today().getTime()) / 86400000);
      return days >= 0 && days <= 45;
    });
    const lateSteps = active.reduce((sum, item) => sum + (Array.isArray(item.checklist) ? item.checklist : []).filter((step) => {
      if (step?.done) return false;
      const due = effectiveDue(item, step);
      return Boolean(due && due.getTime() < today().getTime());
    }).length, 0);
    setMetric('Em acompanhamento', active.length, 'Checklists ativos');
    setMetric('Próximas inaugurações', upcoming.length, 'Nos próximos 45 dias');
    setMetric('Etapas atrasadas', lateSteps, 'Precisam de ação');

    const tracked = document.querySelector('.pmh-tracked');
    if (tracked) renderHistory(tracked, archived);
    requestAnimationFrame(ensureEndButton);
  };

  document.addEventListener('click', async (event) => {
    const end = event.target.closest?.('[data-inauguration-end]');
    if (end) {
      event.preventDefault();
      const id = String(end.dataset.inaugurationEnd || '');
      if (!id || !window.confirm('Encerrar esta inauguração e mover para o histórico?')) return;
      end.disabled = true;
      try {
        await saveStatus(id, 'closed', 'manual');
        document.querySelector('[data-inauguration-back]')?.click();
        apply();
      } catch (error) {
        end.disabled = false;
        window.alert(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    const reopen = event.target.closest?.('[data-inauguration-reopen]');
    if (reopen) {
      event.preventDefault();
      const id = String(reopen.dataset.inaugurationReopen || '');
      if (!id) return;
      reopen.disabled = true;
      try {
        await saveStatus(id, 'open', 'manual-reopen');
        apply();
      } catch (error) {
        reopen.disabled = false;
        window.alert(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (event.target.closest?.('[data-inauguration-open]')) requestAnimationFrame(ensureEndButton);
  }, true);

  window.addEventListener('pmh:view-rendered', (event) => {
    if (String(event.detail?.view || '') !== 'inauguracoes') return;
    loadStatuses().then(apply);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !window.location.hash.includes('inaugur')) return;
    loadStatuses(true).then(apply);
  });

  loadStatuses().then(apply);
})();
