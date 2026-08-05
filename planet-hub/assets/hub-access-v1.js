(() => {
  'use strict';
  const SCRIPT_SEQUENCE = [
    '/planet-hub/assets/unified-hub-v1.js?v=20260805-1',
    '/planet-hub/assets/financeiro-v1.js?v=20260804-1',
  ];

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });

  const startHub = async (access) => {
    window.PMH_ACCESS = access;
    document.documentElement.classList.remove('pmh-access-pending');
    for (const src of SCRIPT_SEQUENCE) await loadScript(src);
    window.dispatchEvent(new CustomEvent('pmh:access-ready', { detail: access }));
  };

  const renderLogin = (message = '') => {
    document.documentElement.classList.remove('pmh-access-pending');
    document.body.innerHTML = `<main class="pmh-access-screen"><form class="pmh-access-card"><div class="pmh-access-brand"><span>A</span><div><strong>André OS</strong><small>MARKETING COMMAND</small></div></div><h1>Acesso ao comando</h1><p>Entre com a senha interna para acessar chamados, inaugurações, fornecedores e pagamentos da operação.</p><label>Senha de acesso<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Entrar no sistema</button><p class="pmh-access-error" ${message ? '' : 'hidden'}>${message}</p></form></main>`;
    const form = document.querySelector('.pmh-access-card');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const error = form.querySelector('.pmh-access-error');
      button.disabled = true;
      error.hidden = true;
      try {
        const response = await fetch('/api/hub/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ password: new FormData(form).get('password') }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Não foi possível entrar.');
        location.reload();
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause);
        error.hidden = false;
        button.disabled = false;
      }
    });
  };

  const boot = async () => {
    try {
      const response = await fetch('/api/hub/session', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível verificar o acesso.');
      if (payload.configured && !payload.authenticated) return renderLogin();
      await startHub(payload);
    } catch (cause) {
      renderLogin(cause instanceof Error ? cause.message : String(cause));
    }
  };

  boot();
})();
