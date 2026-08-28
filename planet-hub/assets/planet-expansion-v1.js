(() => {
  'use strict';

  const VIEW = 'expansao';
  const API = '/api/hub/planet/leads';
  const RECENT_UNVIEWED_WINDOW_MS = 24 * 60 * 60 * 1000;
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
  let activationFrame = 0;

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

  const isRecentUnviewed = (lead, now = Date.now()) => {
    if (!lead || lead.viewedAt) return false;
    const timestamp = Date.parse(lead.createdAt || lead.updatedAt || 0);
    return Number.isFinite(timestamp)
      && Math.max(0, now - timestamp) < RECENT_UNVIEWED_WINDOW_MS;
  };

  const recentUnviewedCount = (leads = state.leads, now = Date.now()) => (
    (Array.isArray(leads) ? leads : []).filter((lead) => isRecentUnviewed(lead, now)).length
  );

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

  const navigationButton = () => document.querySelector('.pmh-sidebar nav [data-expansion-nav]');

  const syncNavigation = () => {
    const button = navigationButton();
    if (!button) return;
    const recentUnread = recentUnviewedCount();
    const totalUnread = state.leads.filter((lead) => !lead.viewedAt).length;
    const badge = button.querySelector('[data-expansion-badge]');
    button.classList.toggle('active', isOpen());
    button.setAttribute(
      'aria-label',
      totalUnread > recentUnread
        ? `Expansão · ${recentUnread} novos nas últimas 24h · ${totalUnread} não visualizados no total`
        : recentUnread > 0
          ? `Expansão · ${recentUnread} novos nas últimas 24h`
          : 'Expansão',
    );
    if (badge) {
      badge.hidden = recentUnread <= 0;
      badge.textContent = recentUnread > 99 ? '99+' : String(recentUnread || '');
      badge.title = totalUnread > recentUnread
        ? `${recentUnread} novos nas últimas 24h · ${totalUnread} não visualizados no total`
        : `${recentUnread} novos nas últimas 24h`;
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
      button.innerHTML = '<i aria-hidden="true">↗</i><span class="aos-mobile-nav-label" data-full-label="Expansão">Expansão</span><b data-expansion-badge hidden>0</b>';
      nav.appendChild(button);
    }

    button.type = 'button';
    button.classList.add('pmh-expansion-nav');

    if (!button.querySelector('[data-expansion-badge]')) {
      const badge = document.createElement('b');
      badge.dataset.expansionBadge = '1';
      badge.hidden = true;
      badge.textContent = '0';
      button.appendChild(badge);
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
      <section class="pmh-expansion-panel" data-expansion-leads-panel>
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

  const scheduleActivate = () => {
    if (activationFrame) cancelAnimationFrame(activationFrame);
    activationFrame = requestAnimationFrame(() => {
      activationFrame = 0;
      activate();
    });
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
    if (isOpen()) scheduleActivate();
    else syncNavigation();
  });

  window.PlanetExpansion = { render, recentUnviewedCount };

  ensureNavigation();
  connectNotifications();
  load({ silent: true });
  if (isOpen()) activate();
})();