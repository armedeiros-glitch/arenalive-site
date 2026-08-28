(() => {
  'use strict';

  const VERSION = '20260828-1';
  const MAX_ARRAY_ITEMS = 500;
  const MAX_STRING = 6000;
  const SENSITIVE_KEY = /(token|secret|password|senha|authorization|cookie|api[_-]?key|access[_-]?key|refresh[_-]?token)/i;

  const SOURCES = [
    ['Radar pessoal · hoje', '/api/radar/today', 'Fonte oficial das tarefas pessoais do André. Não confundir com Radar Operacional da Planet.'],
    ['Chamados SULTS', '/api/sults/chamados?start=0&limit=100', 'Status oficial dos chamados. O André OS adiciona leitura e contexto, mas não altera automaticamente o status do SULTS.'],
    ['Implantações SULTS', '/api/sults/implantacoes?start=0&limit=100', 'Leitura da origem SULTS para implantações.'],
    ['Inaugurações · projetos', '/api/hub/inauguracoes', 'Projetos de inauguração do André OS, incluindo checklist e datas operacionais.'],
    ['Demandas internas', '/api/hub/demandas-internas', 'Demandas operacionais internas da Planet. Não são tarefas pessoais do Todoist/Radar André.'],
    ['Campanhas · operação', '/api/hub/campanhas', 'Camada operacional persistida das campanhas: status, responsável, próximo marco, data do marco, materiais e notas. Não é o catálogo anual completo; campanhas sem edição operacional podem não aparecer aqui.'],
    ['Contextos operacionais do Radar', '/api/hub/radar-contextos', 'Contexto adicional dos itens operacionais, como dependência, bloqueio, próximo passo e data de follow-up. Não é a fila pessoal do Radar André.'],
    ['Notificações Planet', '/api/hub/planet/notifications', 'Alertas operacionais visíveis da Planet. Movimentações de baixo sinal do RD podem permanecer auditáveis sem aparecer no sino.'],
    ['Aquisição · LP Franquias', '/api/hub/planet/acquisition/lp-franquias', 'Métricas agregadas da aquisição pela landing page.'],
    ['Expansão · leads', '/api/hub/planet/leads', 'Leads reais de expansão e seu acompanhamento comercial.'],
    ['Planet 5 Estrelas · avaliações', '/api/hub/planet/five-stars/evaluations', 'Avaliações das unidades no programa Planet 5 Estrelas.'],
    ['Planet 5 Estrelas · planos de ação', '/api/hub/planet/five-stars/action-plans', 'Planos de ação operacionais do Planet 5 Estrelas. Não transformar automaticamente em tarefas pessoais.'],
    ['Laboratório · projetos', '/api/hub/laboratory/projects', 'Projetos do ambiente Laboratório do André OS.'],
  ];

  const safeClone = (value, depth = 0) => {
    if (depth > 10) return '[profundidade limitada]';
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… [texto cortado]` : value;
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => safeClone(item, depth + 1));
      if (value.length > MAX_ARRAY_ITEMS) items.push(`[${value.length - MAX_ARRAY_ITEMS} itens adicionais omitidos]`);
      return items;
    }
    if (typeof value === 'object') {
      const next = {};
      Object.entries(value).forEach(([key, item]) => {
        if (SENSITIVE_KEY.test(key)) {
          next[key] = '[removido pelo EJECT]';
          return;
        }
        next[key] = safeClone(item, depth + 1);
      });
      return next;
    }
    return String(value);
  };

  const fetchSource = async ([label, url, meaning]) => {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        return { label, url, meaning, ok: false, status: response.status, error: payload?.error || `HTTP ${response.status}` };
      }
      return { label, url, meaning, ok: true, status: response.status, data: safeClone(payload) };
    } catch (error) {
      return { label, url, meaning, ok: false, status: 0, error: String(error?.message || error || 'Falha de rede') };
    }
  };

  const currentSurface = () => {
    const mainTitle = document.querySelector('main h1, [data-title], .pmh-main h1')?.textContent?.trim() || '';
    const visibleText = document.querySelector('[data-content]')?.innerText?.trim() || '';
    return safeClone({
      hash: location.hash,
      title: mainTitle,
      visibleText: visibleText.slice(0, 12000),
    });
  };

  const buildSnapshot = async () => {
    const startedAt = new Date();
    const results = await Promise.all(SOURCES.map(fetchSource));
    const available = results.filter((item) => item.ok);
    const unavailable = results.filter((item) => !item.ok);
    const snapshot = {
      ejectVersion: VERSION,
      generatedAt: startedAt.toISOString(),
      page: location.href,
      currentSurface: currentSurface(),
      sourceSummary: {
        requested: results.length,
        available: available.length,
        unavailable: unavailable.map(({ label, status, error }) => ({ label, status, error })),
      },
      sourceSemantics: Object.fromEntries(results.map(({ label, meaning }) => [label, meaning])),
      sources: Object.fromEntries(results.map((item) => [item.label, item.ok ? item.data : { unavailable: true, status: item.status, error: item.error }])),
    };

    return `ANDRÉ OS · EJECT OPERACIONAL\n\n` +
      `Use este snapshot como fonte do estado atual do André OS. Analise o que precisa de atenção agora: atrasos, pendências, gargalos, inconsistências, riscos, próximos passos e itens que podem ser ignorados por enquanto. Não crie tarefas automaticamente. Se sugerir ações, priorize poucas e concretas. Respeite sourceSemantics antes de concluir que uma fonte está incompleta. Em especial, "Campanhas · operação" é somente a camada operacional persistida e não representa o catálogo anual completo.\n\n` +
      `Gerado em: ${startedAt.toLocaleString('pt-BR')}\n` +
      `Fontes disponíveis: ${available.length}/${results.length}\n\n` +
      `--- INÍCIO DO SNAPSHOT ---\n` +
      `${JSON.stringify(snapshot, null, 2)}\n` +
      `--- FIM DO SNAPSHOT ---`;
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  };

  const ensureStyles = () => {
    if (document.querySelector('style[data-andre-os-eject-style]')) return;
    const style = document.createElement('style');
    style.dataset.andreOsEjectStyle = '1';
    style.textContent = `
      .aos-eject-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 13px;border:1px solid rgba(108,92,255,.24);border-radius:11px;color:#fff;background:#17141f;box-shadow:0 8px 22px rgba(20,17,32,.14);font:900 11px/1 Arial,sans-serif;letter-spacing:.08em;cursor:pointer;white-space:nowrap}
      .aos-eject-button:hover{transform:translateY(-1px);box-shadow:0 11px 26px rgba(20,17,32,.2)}
      .aos-eject-button b{font-size:15px;line-height:1;color:#8b78ff}
      .aos-eject-fallback{position:fixed;right:18px;bottom:18px;z-index:118}
      .aos-eject-modal{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:22px;background:rgba(13,11,20,.68);backdrop-filter:blur(8px)}
      .aos-eject-dialog{width:min(900px,100%);max-height:calc(100vh - 44px);overflow:auto;border:1px solid rgba(255,255,255,.14);border-radius:22px;background:#fff;box-shadow:0 34px 100px rgba(0,0,0,.32)}
      .aos-eject-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 24px 16px;border-bottom:1px solid #e8e6ef}
      .aos-eject-head small{display:block;color:#6954ff;font:900 10px/1 Arial,sans-serif;letter-spacing:.1em}
      .aos-eject-head h2{margin:6px 0 4px;color:#17141f;font:800 25px/1.15 Arial,sans-serif}
      .aos-eject-head p{margin:0;color:#6d6a78;font:13px/1.45 Arial,sans-serif}
      .aos-eject-close{width:38px;height:38px;border:1px solid #dedbe7;border-radius:10px;background:#f8f7fb;color:#383442;font-size:22px;cursor:pointer}
      .aos-eject-body{padding:18px 24px 22px}
      .aos-eject-status{padding:14px;border-radius:12px;background:#f6f4ff;color:#5540ca;font:700 13px/1.45 Arial,sans-serif}
      .aos-eject-preview{width:100%;min-height:330px;margin-top:13px;padding:14px;border:1px solid #dedbe7;border-radius:12px;resize:vertical;background:#fbfafc;color:#292630;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
      .aos-eject-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:13px}
      .aos-eject-actions button{min-height:40px;padding:0 14px;border-radius:10px;font:800 12px Arial,sans-serif;cursor:pointer}
      .aos-eject-copy{border:0;color:#fff;background:#6954ff}.aos-eject-secondary{border:1px solid #dedbe7;color:#373342;background:#fff}
      @media(max-width:820px){.aos-eject-button{min-height:36px;padding:0 10px}.aos-eject-button span{display:none}.aos-eject-dialog{border-radius:18px}.aos-eject-head,.aos-eject-body{padding-left:16px;padding-right:16px}}
    `;
    document.head.appendChild(style);
  };

  const closeModal = () => document.querySelector('.aos-eject-modal')?.remove();

  const openModal = async () => {
    closeModal();
    const modal = document.createElement('div');
    modal.className = 'aos-eject-modal';
    modal.innerHTML = `<section class="aos-eject-dialog" role="dialog" aria-modal="true" aria-label="EJECT do André OS">
      <header class="aos-eject-head"><div><small>ANDRÉ OS · EJECT</small><h2>Pacote de contexto para o ChatGPT</h2><p>Reúne o estado operacional atual, remove credenciais e explica o papel de cada fonte antes da análise.</p></div><button class="aos-eject-close" type="button" aria-label="Fechar">×</button></header>
      <div class="aos-eject-body"><div class="aos-eject-status">Coletando as fontes do André OS…</div><textarea class="aos-eject-preview" readonly hidden></textarea><div class="aos-eject-actions"><button class="aos-eject-secondary" type="button">Fechar</button><button class="aos-eject-copy" type="button" disabled>Copiar EJECT</button></div></div>
    </section>`;
    document.body.appendChild(modal);
    modal.querySelector('.aos-eject-close').addEventListener('click', closeModal);
    modal.querySelector('.aos-eject-secondary').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

    const status = modal.querySelector('.aos-eject-status');
    const preview = modal.querySelector('.aos-eject-preview');
    const copy = modal.querySelector('.aos-eject-copy');
    try {
      const text = await buildSnapshot();
      preview.value = text;
      preview.hidden = false;
      status.textContent = `EJECT pronto · ${(text.length / 1024).toFixed(1)} KB. Confira se quiser e copie para colar no ChatGPT.`;
      copy.disabled = false;
      copy.addEventListener('click', async () => {
        const ok = await copyText(preview.value);
        copy.textContent = ok ? 'Copiado ✓' : 'Selecione e copie';
        if (!ok) preview.select();
      });
    } catch (error) {
      status.textContent = `Não foi possível montar o EJECT: ${String(error?.message || error || 'erro inesperado')}`;
    }
  };

  const installButton = () => {
    ensureStyles();
    if (document.querySelector('[data-andre-os-eject]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'aos-eject-button';
    button.dataset.andreOsEject = VERSION;
    button.title = 'Copiar contexto operacional do André OS';
    button.innerHTML = '<b>↥</b><span>EJECT</span>';
    button.addEventListener('click', openModal);

    const host = document.querySelector('.pmh-top-actions, .aos-topbar-actions, [data-top-actions], .andre-os-top-actions');
    if (host) host.prepend(button);
    else {
      button.classList.add('aos-eject-fallback');
      document.body.appendChild(button);
    }
  };

  document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(installButton), { once: true });
  window.addEventListener('pmh:view-rendered', () => requestAnimationFrame(installButton));
  window.addEventListener('hashchange', () => requestAnimationFrame(installButton));
  if (document.readyState !== 'loading') requestAnimationFrame(installButton);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('.aos-eject-modal')) closeModal();
  });

  window.AndreOSEject = Object.freeze({
    buildSnapshot,
    safeClone,
    sources: SOURCES.map(([label, url, meaning]) => ({ label, url, meaning })),
  });
})();