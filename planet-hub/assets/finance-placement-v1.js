(() => {
  'use strict';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const decorate = () => {
    const sidebarButton = document.querySelector('.pmh-sidebar nav [data-finance-open]');
    if (sidebarButton) {
      sidebarButton.hidden = true;
      sidebarButton.setAttribute('aria-hidden', 'true');
      sidebarButton.tabIndex = -1;
    }

    const title = document.querySelector('[data-title]')?.textContent || '';
    if (!normalize(title).includes('inauguracoes')) return;

    const head = document.querySelector('.pmh-content .pmh-section-head');
    if (!head || head.querySelector('[data-inauguration-finance-open]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pmh-inauguration-finance-access';
    button.dataset.financeOpen = '1';
    button.dataset.inaugurationFinanceOpen = '1';
    button.textContent = 'Financeiro das inaugurações';
    button.title = 'Abrir fornecedores, pagamentos e solicitações das inaugurações';
    head.appendChild(button);
  };

  const style = document.createElement('style');
  style.textContent = `
    .pmh-sidebar nav [data-finance-open]{display:none!important}
    .pmh-section-head [data-inauguration-finance-open]{flex:0 0 auto}
    @media(max-width:820px){.pmh-section-head [data-inauguration-finance-open]{width:100%;margin-left:0}}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
