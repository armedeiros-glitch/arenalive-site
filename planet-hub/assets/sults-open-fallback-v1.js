(() => {
  'use strict';

  const SULTS_LIST_URL = 'https://planetchocolate.sults.com.br/chamados';
  const DIRECT_PREFIX = 'https://planetchocolate.sults.com.br/chamados/interacoes/';

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      return copied;
    }
  };

  const toast = (message) => {
    document.querySelector('.pmh-sults-toast')?.remove();
    const element = document.createElement('div');
    element.className = 'pmh-sults-toast';
    element.textContent = message;
    document.body.appendChild(element);
    requestAnimationFrame(() => element.classList.add('visible'));
    window.setTimeout(() => {
      element.classList.remove('visible');
      window.setTimeout(() => element.remove(), 220);
    }, 3200);
  };

  const decorate = () => {
    document.querySelectorAll(`a[href^="${DIRECT_PREFIX}"]`).forEach((link) => {
      if (link.dataset.sultsFallbackReady === '1') return;
      const id = link.href.slice(DIRECT_PREFIX.length).split(/[?#/]/)[0].replace(/\D/g, '');
      if (!id) return;
      link.dataset.sultsFallbackReady = '1';
      link.dataset.sultsTicketId = id;
      link.href = SULTS_LIST_URL;
      link.textContent = `Copiar #${id} e abrir SULTS ↗`;
      link.title = 'O SULTS retorna links externos para a lista. O número será copiado para você colar na busca.';
    });
  };

  document.addEventListener('click', async (event) => {
    const link = event.target.closest('[data-sults-fallback-ready]');
    if (!link) return;
    event.preventDefault();

    const ticketId = link.dataset.sultsTicketId;
    const popup = window.open(SULTS_LIST_URL, '_blank', 'noopener,noreferrer');
    const copied = await copyText(ticketId);

    if (!popup) {
      window.location.href = SULTS_LIST_URL;
      return;
    }

    toast(copied
      ? `Chamado #${ticketId} copiado. Cole na busca do SULTS.`
      : `Abra a busca do SULTS e procure pelo chamado #${ticketId}.`);
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .pmh-sults-toast{position:fixed;right:24px;bottom:24px;z-index:1000001;max-width:min(420px,calc(100vw - 32px));padding:14px 17px;border-radius:12px;color:#fff;background:#2f211c;box-shadow:0 18px 48px rgba(35,20,14,.28);font-size:14px;font-weight:800;opacity:0;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease}
    .pmh-sults-toast.visible{opacity:1;transform:translateY(0)}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
