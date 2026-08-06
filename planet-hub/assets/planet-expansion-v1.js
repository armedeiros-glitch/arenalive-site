(() => {
  'use strict';

  const VIEW = 'expansao';
  const API = '/api/hub/planet/leads';
  const STATUS_LABELS = {
    new: 'Novo',
    claimed: 'Assumido',
    contacted: 'Contatado',
    qualified: 'Qualificado',
    discarded: 'Descartado',
  };

  const state = {
    leads: [],
    loading: false,
    error: '',
    notice: '',
    noticeTone: 'success',
    selectedLeadId: '',
    revision: null,
    updatedAt: null,
    loaded: false,
  };

  let noticeTimer = 0;
  let unsubscribeNotifications = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const fmtDate = (value) => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return 'Sem sincronização';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  const digits = (value) => String(value || '').replace(/\D/g, '');
  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');
  const isOpen = () => location.hash === '#expansao';

  const showNotice = (message, tone = 'success') => {
    clearTimeout(noticeTimer);
    state.notice = String(message || '');
    state.noticeTone = tone;
    if (isOpen()) render();
    noticeTimer = window.setTimeout(() => {
      state.notice = '';
      if (isOpen()) render();
    }, 3500);
  };

  const injectStyles = () => {
    if (document.querySelector('[data-planet-expansion-styles]')) return;
    const style = document.createElement('style');
    style.dataset.planetExpansionStyles = '1';
    style.textContent = `
      .pmh-expansion-shell{display:grid;gap:20px}
      .pmh-expansion-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:24px;border:1px solid #eadbd4;border-radius:20px;background:#fff}
      .pmh-expansion-head small{color:#7558e8;font-weight:900;letter-spacing:.08em}.pmh-expansion-head h2{margin:6px 0 8px;font-size:30px}.pmh-expansion-head p{margin:0;color:#6d5a52}
      .pmh-expansion-head-actions{display:flex;align-items:flex-end;gap:10px;flex-direction:column}.pmh-expansion-head-actions small{color:#84726a;font-size:11px;letter-spacing:0;text-align:right}
      .pmh-expansion-refresh{min-height:40px;padding:0 14px;border:1px solid #d9d0ff;border-radius:12px;color:#5d45c7;background:#f6f3ff;font-weight:850}.pmh-expansion-refresh:hover{background:#ece7ff}.pmh-expansion-refresh:disabled{cursor:wait;opacity:.65}
      .pmh-expansion-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .pmh-expansion-metrics article{padding:18px;border:1px solid #eadbd4;border-radius:16px;background:#fff}.pmh-expansion-metrics small{display:block;color:#78665e;font-weight:800}.pmh-expansion-metrics strong{display:block;margin-top:7px;font-size:28px}
      .pmh-expansion-list{display:grid;gap:12px}.pmh-expansion-lead{position:relative;border:1px solid #e7d8d1;border-radius:15px;background:#fff;overflow:hidden;transition:.18s ease}
      .pmh-expansion-lead:hover{border-color:#b9a9f2;box-shadow:0 10px 25px rgba(58,43,50,.07)}.pmh-expansion-lead.selected{border-color:#7558e8;background:#faf8ff;box-shadow:0 0 0 3px rgba(117,88,232,.12)}.pmh-expansion-lead.unread:before{content:'';position:absolute;z-index:2;left:-1px;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:#d94b4b}
      .pmh-expansion-lead-main{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(130px,.7fr) minmax(150px,.8fr) auto;gap:16px;align-items:center;width:100%;padding:17px 18px;border:0;color:inherit;background:transparent;text-align:left}
      .pmh-expansion-lead-main:hover{background:rgba(117,88,232,.035)}.pmh-expansion-lead strong,.pmh-expansion-lead span{display:block}.pmh-expansion-lead small{color:#7a675f}
      .pmh-expansion-status{padding:7px 10px;border-radius:999px;background:#eee9ff;color:#5e46c8;font-size:12px;font-weight:900;text-align:center;text-transform:uppercase}
      .pmh-expansion-lead-details{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;padding:16px 18px 18px;border-top:1px solid #ece1dc;background:#fff}
      .pmh-expansion-contact{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px;margin:0}.pmh-expansion-contact div{min-width:0}.pmh-expansion-contact dt{color:#8a756c;font-size:10px;font-weight:900;letter-spacing:.08em}.pmh-expansion-contact dd{margin:4px 0 0;overflow-wrap:anywhere;color:#3f332e;font-size:13px;font-weight:700}
      .pmh-expansion-actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px}.pmh-expansion-actions button,.pmh-expansion-actions a{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 12px;border:1px solid #ddd1cb;border-radius:10px;color:#554640;background:#fff;font-size:12px;font-weight:850;text-decoration:none}.pmh-expansion-actions button:hover,.pmh-expansion-actions a:hover{border-color:#b9a9f2;background:#f7f4ff}.pmh-expansion-actions .primary{border-color:#6e54df;color:#fff;background:#6e54df}.pmh-expansion-actions .primary:hover{background:#5d45c7}
      .pmh-expansion-empty{padding:48px 24px;border:1px dashed #d7c4ba;border-radius:18px;background:#fff;text-align:center}.pmh-expansion-empty b{display:block;margin-bottom:8px;font-size:20px}.pmh-expansion-empty span{display:block;color:#78665e}.pmh-expansion-empty em{display:block;margin-top:10px;color:#9a7c70;font-size:12px;font-style:normal}
      .pmh-expansion-error,.pmh-expansion-notice{padding:13px 14px;border-radius:12px}.pmh-expansion-error{border:1px solid #f0b8b8;background:#fff1f1;color:#8f2727}.pmh-expansion-notice{border:1px solid #b9dfd0;background:#edf9f4;color:#226d52}.pmh-expansion-notice.error{border-color:#f0b8b8;background:#fff1f1;color:#8f2727}
      .pmh-sidebar [data-expansion-nav] [data-expansion-badge][hidden]{display:none!important}
      @media(max-width:920px){.pmh-expansion-lead-main{grid-template-columns:1fr 1fr}.pmh-expansion-status{justify-self:start}.pmh-expansion-lead-details{grid-template-columns:1fr}.pmh-expansion-actions{justify-content:flex-start}}
      @media(max-width:760px){.pmh-expansion-head{padding:18px;flex-direction:column}.pmh-expansion-head h2{font-size:25px}.pmh-expansion-head-actions{align-items:flex-start}.pmh-expansion-head-actions small{text-align:left}.pmh-expansion-metrics{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.pmh-expansion-metrics article{padding:12px 9px}.pmh-expansion-metrics small{font-size:9px}.pmh-expansion-metrics strong{font-size:22px}.pmh-expansion-lead-main{grid-template-columns:1fr;gap:8px}.pmh-expansion-contact{grid-template-columns:1fr}.pmh-expansion-actions{display:grid;grid-template-columns:1fr 1fr}.pmh-expansion-actions button,.pmh-expansion-actions a{width:100%}}
    `;
    document.head.appendChild(style);
  };

  const navigationButton = () => document.querySelector('.pmh-sidebar nav [data-expansion-nav]');

  const syncNavigation = () => {
    const button = navigationButton();
    if (!button) return;
    const unread = state.leads.filter((lead) => !lead.viewedAt).length;
    const badge = button.querySelector('[data-expansion-badge]');
    button.classList.toggle('active', isOpen());
    if (badge) {
      badge.hidden = unread <= 0;
      badge.textContent = unread > 99 ? '99+' : String(unread || '');
    }
  };

  const ensureNavigation = () => {
    const nav = document.querySelector('.pmh-sidebar nav');
    if (!nav) return null;

    let button = nav.querySelector(':scope > [data-expansion-nav]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.expansionNav = '1';
    }

    button.type = 'button';
    button.classList.add('pmh-expansion-nav');
    button.setAttribute('aria-label', 'Expansão');
    button.innerHTML = '<i aria-hidden="true">↗</i><span class="aos-mobile-nav-label" data-full-label="Expansão">Expansão</span><b data-expansion-badge hidden>0</b>';

    const inauguration = nav.querySelector(':scope > [data-view="inauguracoes"]');
    if (inauguration && button.previousElementSibling !== inauguration) {
      inauguration.insertAdjacentElement('afterend', button);
    } else if (!button.parentElement) {
      nav.appendChild(button);
    }

    syncNavigation();
    return button;
  };

  const metrics = () => {
    const unread = state.leads.filter((lead) => !lead.viewedAt).length;
    const active = state.leads.filter((lead) => !['qualified', 'discarded'].includes(lead.status)).length;
    const qualified = state.leads.filter((lead) => lead.status === 'qualified').length;
    return { unread, active, qualified };
  };

  const selectedLead = () => state.leads.find((lead) => lead.id === state.selectedLeadId) || null;

  const contactDetails = (lead) => `<dl class="pmh-expansion-contact">
    <div><dt>TELEFONE</dt><dd>${esc(lead.phone || 'Não informado')}</dd></div>
    <div><dt>E-MAIL</dt><dd>${esc(lead.email || 'Não informado')}</dd></div>
    <div><dt>ORIGEM</dt><dd>${esc(lead.origin || lead.source || 'Não informada')}</dd></div>
    <div><dt>CONVERSÃO</dt><dd>${esc(lead.conversion || 'Não informada')}</dd></div>
  </dl>`;

  const leadActions = (lead) => {
    const whatsapp = lead.whatsappUrl || (digits(lead.phone)
      ? `https://wa.me/${digits(lead.phone)}?text=${encodeURIComponent(lead.whatsappMessage || '')}`
      : '');
    const email = lead.email ? `mailto:${encodeURIComponent(lead.email)}` : '';
    return `<div class="pmh-expansion-actions">
      ${whatsapp ? `<button type="button" class="primary" data-lead-whatsapp="${esc(lead.id)}">Abrir WhatsApp</button>` : ''}
      ${email ? `<a href="${esc(email)}" data-lead-email="${esc(lead.id)}">Abrir e-mail</a>` : ''}
      <button type="button" data-lead-copy="${esc(lead.id)}">Copiar mensagem</button>
      ${lead.status !== 'contacted' && lead.status !== 'qualified' ? `<button type="button" data-lead-status="${esc(lead.id)}" data-status="contacted">Marcar contato</button>` : ''}
      ${lead.status !== 'qualified' ? `<button type="button" data-lead-status="${esc(lead.id)}" data-status="qualified">Qualificar</button>` : ''}
    </div>`;
  };

  const leadCard = (lead) => {
    const selected = state.selectedLeadId === lead.id;
    return `<article class="pmh-expansion-lead ${lead.viewedAt ? '' : 'unread'} ${selected ? 'selected' : ''}" data-lead-id="${esc(lead.id)}">
      <button type="button" class="pmh-expansion-lead-main" data-lead-select="${esc(lead.id)}" aria-expanded="${selected ? 'true' : 'false'}">
        <div><strong>${esc(lead.name)}</strong><small>${esc([lead.city, lead.state].filter(Boolean).join(' · ') || 'Local não informado')}</small></div>
        <div><span>${esc(lead.rdStage || lead.origin || lead.source)}</span><small>${esc(lead.conversion || 'Sem conversão informada')}</small></div>
        <div><span>${esc(fmtDate(lead.createdAt))}</span><small>${esc(lead.assignedTo || 'Sem responsável')}</small></div>
        <span class="pmh-expansion-status">${esc(STATUS_LABELS[lead.status] || lead.status || 'Novo')}</span>
      </button>
      ${selected ? `<section class="pmh-expansion-lead-details">${contactDetails(lead)}${leadActions(lead)}</section>` : ''}
    </article>`;
  };

  const focusSelected = () => {
    if (!state.selectedLeadId || !isOpen()) return;
    requestAnimationFrame(() => {
      const card = document.querySelector(`[data-lead-id="${CSS.escape(state.selectedLeadId)}"]`);
      card?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      card?.querySelector('[data-lead-select]')?.focus?.({ preventScroll: true });
    });
  };

  const emptyState = () => {
    if (state.updatedAt) {
      return `<div class="pmh-expansion-empty"><b>Nenhum lead na base.</b><span>A integração respondeu, mas não há contatos armazenados.</span><em>Última sincronização: ${esc(fmtDate(state.updatedAt))}</em></div>`;
    }
    return '<div class="pmh-expansion-empty"><b>Nenhum evento recebido do RD.</b><span>O André OS ainda não armazenou um webhook válido de lead.</span><em>Use “Atualizar leads”. Se continuar zerado, a entrega precisa ser conferida no RD Station ou na Cloudflare.</em></div>';
  };

  const render = () => {
    if (!isOpen()) return;
    const target = content();
    if (!target) return;

    const values = metrics();
    if (title()) title().textContent = 'Expansão';
    target.innerHTML = `<section class="pmh-expansion-shell">
      <header class="pmh-expansion-head">
        <div><small>PLANET CHOCOLATE · PROFISSIONAL</small><h2>Expansão e Leads</h2><p>Receba o lead, abra o contato e registre o avanço sem sair do André OS.</p></div>
        <div class="pmh-expansion-head-actions">
          <button type="button" class="pmh-expansion-refresh" data-expansion-refresh ${state.loading ? 'disabled' : ''}>${state.loading ? 'Atualizando…' : '↻ Atualizar leads'}</button>
          <small>${state.updatedAt ? `Base atualizada em ${esc(fmtDate(state.updatedAt))}` : 'Aguardando o primeiro webhook válido'}</small>
        </div>
      </header>
      <section class="pmh-expansion-metrics">
        <article><small>NÃO VISUALIZADOS</small><strong>${values.unread}</strong></article>
        <article><small>EM ABERTO</small><strong>${values.active}</strong></article>
        <article><small>QUALIFICADOS</small><strong>${values.qualified}</strong></article>
      </section>
      ${state.notice ? `<div class="pmh-expansion-notice ${state.noticeTone === 'error' ? 'error' : ''}">${esc(state.notice)}</div>` : ''}
      ${state.error ? `<div class="pmh-expansion-error">${esc(state.error)}</div>` : ''}
      <section class="pmh-expansion-list">
        ${state.loading && !state.loaded ? '<div class="pmh-expansion-empty"><b>Carregando leads…</b></div>' : state.leads.length ? state.leads.map(leadCard).join('') : emptyState()}
      </section>
    </section>`;
    focusSelected();
  };

  const load = async ({ silent = false } = {}) => {
    if (!silent) state.loading = true;
    state.error = '';
    if (isOpen()) render();

    try {
      const response = await fetch(API, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      state.leads = Array.isArray(payload.data) ? payload.data : [];
      state.revision = payload.revision || null;
      state.updatedAt = payload.updatedAt || null;
      state.loaded = true;
      if (state.selectedLeadId && !selectedLead()) state.selectedLeadId = '';
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      ensureNavigation();
      if (isOpen()) render();
    }
  };

  const updateLead = async (leadId, changes) => {
    const response = await fetch(API, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, changes }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    state.leads = state.leads.map((item) => item.id === leadId ? payload.lead : item);
    ensureNavigation();
    if (isOpen()) render();
    return payload.lead;
  };

  const markViewed = async (leadId) => {
    const lead = state.leads.find((item) => item.id === leadId);
    if (!lead || lead.viewedAt) return;
    const viewedAt = new Date().toISOString();
    state.leads = state.leads.map((item) => item.id === leadId ? { ...item, viewedAt } : item);
    ensureNavigation();
    if (isOpen()) render();
    try {
      await updateLead(leadId, { viewedAt });
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
      if (isOpen()) render();
    }
  };

  const selectLeadById = (leadId) => {
    if (!leadId) return;
    state.selectedLeadId = state.selectedLeadId === leadId ? '' : leadId;
    if (isOpen()) render();
    if (state.selectedLeadId) markViewed(leadId);
  };

  const copyText = async (value) => {
    const text = String(value || '');
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    document.execCommand('copy');
    field.remove();
  };

  const copyLeadMessage = async (leadId) => {
    const lead = state.leads.find((item) => item.id === leadId);
    if (!lead) return;
    const firstName = String(lead.name || '').trim().split(/\s+/)[0] || '';
    const fallback = firstName
      ? `Olá, ${firstName}! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.`
      : 'Olá! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.';
    try {
      await copyText(lead.whatsappMessage || fallback);
      showNotice('Mensagem copiada. Já está pronta para enviar.');
    } catch {
      showNotice('Não foi possível copiar a mensagem.', 'error');
    }
  };

  const openWhatsApp = (leadId) => {
    const lead = state.leads.find((item) => item.id === leadId);
    if (!lead) return;
    const target = lead.whatsappUrl || (digits(lead.phone)
      ? `https://wa.me/${digits(lead.phone)}?text=${encodeURIComponent(lead.whatsappMessage || '')}`
      : '');
    if (!target) {
      showNotice('Este lead não possui telefone para WhatsApp.', 'error');
      return;
    }

    window.open(target, '_blank', 'noopener,noreferrer');
    const lastActionAt = new Date().toISOString();
    updateLead(leadId, { status: 'contacted', lastActionAt })
      .then(() => showNotice('WhatsApp aberto e lead marcado como contatado.'))
      .catch((error) => showNotice(error instanceof Error ? error.message : String(error), 'error'));
  };

  const setLeadStatus = (leadId, status) => {
    updateLead(leadId, { status, lastActionAt: new Date().toISOString() })
      .then(() => showNotice(status === 'qualified' ? 'Lead qualificado.' : 'Contato registrado.'))
      .catch((error) => showNotice(error instanceof Error ? error.message : String(error), 'error'));
  };

  const activate = () => {
    ensureNavigation();
    state.selectedLeadId = sessionStorage.getItem('planet-expansion-open-lead') || state.selectedLeadId;
    sessionStorage.removeItem('planet-expansion-open-lead');
    document.querySelectorAll('[data-view], [data-expansion-nav]').forEach((item) => item.classList.remove('active'));
    syncNavigation();
    render();
    if (!state.loaded) load();
  };

  const connectNotifications = () => {
    if (unsubscribeNotifications || !window.AndreOS?.events?.on) return;
    unsubscribeNotifications = window.AndreOS.events.on('notifications.updated', () => {
      load({ silent: true });
    }, { replayLatest: true });
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-expansion-nav]');
    if (trigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isOpen()) activate();
      else location.hash = '#expansao';
      return;
    }

    if (event.target.closest?.('[data-expansion-refresh]')) {
      load();
      return;
    }

    const select = event.target.closest?.('[data-lead-select]');
    if (select) {
      selectLeadById(select.dataset.leadSelect || '');
      return;
    }

    const copy = event.target.closest?.('[data-lead-copy]');
    if (copy) {
      copyLeadMessage(copy.dataset.leadCopy || '');
      return;
    }

    const whatsapp = event.target.closest?.('[data-lead-whatsapp]');
    if (whatsapp) {
      openWhatsApp(whatsapp.dataset.leadWhatsapp || '');
      return;
    }

    const status = event.target.closest?.('[data-lead-status]');
    if (status) {
      setLeadStatus(status.dataset.leadStatus || '', status.dataset.status || '');
    }
  }, true);

  window.addEventListener('planet:open-lead', (event) => {
    const leadId = String(event.detail?.leadId || '');
    if (!leadId) return;
    state.selectedLeadId = leadId;
    if (isOpen()) {
      render();
      markViewed(leadId);
      focusSelected();
    } else {
      sessionStorage.setItem('planet-expansion-open-lead', leadId);
      location.hash = '#expansao';
    }
  });

  window.addEventListener('pmh:view-rendered', () => {
    ensureNavigation();
    connectNotifications();
    if (isOpen()) requestAnimationFrame(render);
  });

  window.addEventListener('pmh:access-ready', () => {
    ensureNavigation();
    connectNotifications();
  });

  window.addEventListener('hashchange', () => {
    ensureNavigation();
    if (isOpen()) setTimeout(activate, 0);
    else syncNavigation();
  });

  injectStyles();
  ensureNavigation();
  connectNotifications();
  load({ silent: true });
  if (isOpen()) activate();
})();