(() => {
  'use strict';

  const VIEW = 'expansao';
  const API = '/api/hub/planet/leads';
  const state = { leads: [], loading: false, error: '' };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const fmtDate = (value) => {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');

  const injectStyles = () => {
    if (document.querySelector('[data-planet-expansion-styles]')) return;
    const style = document.createElement('style');
    style.dataset.planetExpansionStyles = '1';
    style.textContent = `
      .pmh-expansion-shell{display:grid;gap:20px}
      .pmh-expansion-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:24px;border:1px solid #eadbd4;border-radius:20px;background:#fff}
      .pmh-expansion-head small{color:#7558e8;font-weight:900;letter-spacing:.08em}.pmh-expansion-head h2{margin:6px 0 8px;font-size:30px}.pmh-expansion-head p{margin:0;color:#6d5a52}
      .pmh-expansion-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .pmh-expansion-metrics article{padding:18px;border:1px solid #eadbd4;border-radius:16px;background:#fff}.pmh-expansion-metrics small{display:block;color:#78665e;font-weight:800}.pmh-expansion-metrics strong{display:block;margin-top:7px;font-size:28px}
      .pmh-expansion-list{display:grid;gap:12px}.pmh-expansion-lead{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(130px,.7fr) minmax(150px,.8fr) auto;gap:16px;align-items:center;padding:17px 18px;border:1px solid #e7d8d1;border-radius:15px;background:#fff}
      .pmh-expansion-lead strong,.pmh-expansion-lead span{display:block}.pmh-expansion-lead small{color:#7a675f}.pmh-expansion-status{padding:7px 10px;border-radius:999px;background:#eee9ff;color:#5e46c8;font-size:12px;font-weight:900;text-transform:uppercase}
      .pmh-expansion-empty{padding:48px 24px;border:1px dashed #d7c4ba;border-radius:18px;background:#fff;text-align:center}.pmh-expansion-empty b{display:block;margin-bottom:8px;font-size:20px}.pmh-expansion-empty span{color:#78665e}
      .pmh-expansion-error{padding:14px;border:1px solid #f0b8b8;border-radius:12px;background:#fff1f1;color:#8f2727}
      @media(max-width:760px){.pmh-expansion-head{padding:18px}.pmh-expansion-head h2{font-size:25px}.pmh-expansion-metrics{grid-template-columns:1fr}.pmh-expansion-lead{grid-template-columns:1fr;gap:8px}}
    `;
    document.head.appendChild(style);
  };

  const navCandidates = () => [...document.querySelectorAll('[data-view="conteudos"], [data-view="calendario"], [data-view="inauguracoes"]')];

  const injectNavigation = () => {
    if (document.querySelector('[data-expansion-nav]')) return;
    const reference = navCandidates().find((item) => item.closest('nav,aside'));
    if (!reference) return;
    const button = reference.cloneNode(true);
    button.removeAttribute('data-view');
    button.dataset.expansionNav = '1';
    button.type = 'button';
    const icon = button.querySelector('i,span:first-child');
    const label = button.querySelector('strong,span:last-child');
    if (icon) icon.textContent = '📈';
    if (label) label.textContent = 'Expansão';
    if (!label) button.textContent = '📈 Expansão';
    reference.insertAdjacentElement('afterend', button);
  };

  const metrics = () => {
    const unread = state.leads.filter((lead) => !lead.viewedAt).length;
    const active = state.leads.filter((lead) => !['qualified', 'discarded'].includes(lead.status)).length;
    const qualified = state.leads.filter((lead) => lead.status === 'qualified').length;
    return { unread, active, qualified };
  };

  const leadCard = (lead) => `<article class="pmh-expansion-lead" data-lead-id="${esc(lead.id)}">
    <div><strong>${esc(lead.name)}</strong><small>${esc([lead.city, lead.state].filter(Boolean).join(' · ') || 'Local não informado')}</small></div>
    <div><span>${esc(lead.origin || lead.source)}</span><small>${esc(lead.conversion || 'Sem conversão informada')}</small></div>
    <div><span>${esc(fmtDate(lead.createdAt))}</span><small>${esc(lead.assignedTo || 'Sem responsável')}</small></div>
    <span class="pmh-expansion-status">${esc(lead.status)}</span>
  </article>`;

  const render = () => {
    const target = content();
    if (!target) return;
    const values = metrics();
    if (title()) title().textContent = 'Expansão';
    target.innerHTML = `<section class="pmh-expansion-shell">
      <header class="pmh-expansion-head"><div><small>PLANET CHOCOLATE · PROFISSIONAL</small><h2>Expansão e Leads</h2><p>Base única para RD Station, reativação e futuro Caça Lead.</p></div></header>
      <section class="pmh-expansion-metrics">
        <article><small>NÃO VISUALIZADOS</small><strong>${values.unread}</strong></article>
        <article><small>EM ABERTO</small><strong>${values.active}</strong></article>
        <article><small>QUALIFICADOS</small><strong>${values.qualified}</strong></article>
      </section>
      ${state.error ? `<div class="pmh-expansion-error">${esc(state.error)}</div>` : ''}
      <section class="pmh-expansion-list">
        ${state.loading ? '<div class="pmh-expansion-empty"><b>Carregando leads…</b></div>' : state.leads.length ? state.leads.map(leadCard).join('') : '<div class="pmh-expansion-empty"><b>Nenhum lead ainda.</b><span>Quando o RD Station for conectado, os novos contatos aparecerão aqui automaticamente.</span></div>'}
      </section>
    </section>`;
  };

  const load = async () => {
    state.loading = true;
    state.error = '';
    render();
    try {
      const response = await fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      state.leads = Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      render();
    }
  };

  const open = () => {
    location.hash = '#expansao';
    document.querySelectorAll('[data-view], [data-expansion-nav]').forEach((item) => item.classList.remove('active'));
    document.querySelector('[data-expansion-nav]')?.classList.add('active');
    render();
    load();
    window.AndreOS?.events?.emit?.('navigation.viewChanged', {
      view: VIEW,
      content: content(),
      viewId: `${VIEW}:${Date.now()}`,
    }, { retain: true });
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-expansion-nav]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open();
  }, true);

  window.addEventListener('pmh:view-rendered', () => {
    injectNavigation();
    if (location.hash === '#expansao') setTimeout(render, 0);
  });

  window.addEventListener('hashchange', () => {
    if (location.hash === '#expansao') setTimeout(open, 0);
  });

  injectStyles();
  const observer = new MutationObserver(injectNavigation);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  injectNavigation();
})();
