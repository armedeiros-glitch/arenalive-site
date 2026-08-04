(() => {
  const PROJECTS_API = '/api/sults/implantacoes?start=0&limit=100';
  const TRACKED_KEY = 'planet-hub-inaugurations-v2';

  const checklistTemplate = [
    { action: 'Número de telefone para redes sociais', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Criação/ajuste do Instagram', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Criação/ajuste do Facebook', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Google Meu Negócio', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Vídeo de inauguração', owner: 'Franqueadora', daysBefore: 20 },
    { action: 'Enviar @ dos influenciadores', owner: 'Franqueado', daysBefore: 20 },
    { action: 'Contratar influenciadores', owner: 'Franqueado', daysBefore: 15 },
    { action: 'Contratar Social Media para inauguração', owner: 'Franqueado', daysBefore: 15 },
    { action: 'Contratar ornamentação / arco de bolas', owner: 'Franqueado', daysBefore: 15 },
    { action: 'Aprovar artes inaugurais', owner: 'Franqueadora', daysBefore: 12 },
    { action: 'Fazer 1000 panfletos', owner: 'Franqueado', daysBefore: 10 },
    { action: 'Entregar panfletos para lojistas', owner: 'Franqueado', daysBefore: 7 },
    { action: 'Configurar tráfego pago', owner: 'Franqueadora', daysBefore: 7 },
    { action: 'Separar brindes/cupons', owner: 'Franqueado', daysBefore: 5 },
    { action: 'Conferência final da operação', owner: 'Franqueadora', daysBefore: 3 },
  ];

  let projectsCache = null;
  let modal = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character]));

  const readTracked = () => {
    try {
      const items = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  };

  const writeTracked = (items) => {
    window.localStorage.setItem(TRACKED_KEY, JSON.stringify(items));
  };

  const makeChecklist = () => checklistTemplate.map((item) => ({ ...item, done: false }));

  const loadProjects = async () => {
    if (projectsCache) return projectsCache;
    const response = await fetch(PROJECTS_API, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar as implantações do SULTS.');
    projectsCache = Array.isArray(payload.data) ? payload.data : [];
    return projectsCache;
  };

  const closeModal = () => {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  const refreshInaugurations = () => {
    const button = document.querySelector('[data-pmh-open="inauguracoes"]');
    if (button) {
      button.click();
      return;
    }
    window.location.hash = '#nucleo/inauguracoes';
    window.location.reload();
  };

  const ensureModal = (projects) => {
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'pmh-inauguration-modal';
    modal.hidden = true;
    modal.dataset.pmhIndependentModal = '1';
    modal.innerHTML = `
      <section class="pmh-inauguration-dialog" role="dialog" aria-modal="true" aria-labelledby="pmh-independent-inauguration-title">
        <header>
          <div>
            <small>NOVA INAUGURAÇÃO</small>
            <h2 id="pmh-independent-inauguration-title">Iniciar acompanhamento</h2>
            <p>Escolha uma implantação do SULTS e informe a data real da inauguração.</p>
          </div>
          <button type="button" data-pmh-independent-close aria-label="Fechar">×</button>
        </header>
        <form>
          <label class="pmh-field-wide">Implantação do SULTS
            <select name="projectId"><option value="">Cadastro manual</option></select>
          </label>
          <label>Unidade<input name="unit" required autocomplete="off"></label>
          <label>Data real da inauguração<input name="openingDate" type="date" required></label>
          <label>Responsável<input name="responsible" autocomplete="off"></label>
          <label>Shopping / local<input name="location" autocomplete="off"></label>
          <p>Ao salvar, a inauguração entra com o checklist de 15 etapas e as seis ações inaugurais, usando a verba padrão de R$ 4.100.</p>
          <footer>
            <button type="button" data-pmh-independent-close>Cancelar</button>
            <button type="submit">Criar inauguração</button>
          </footer>
        </form>
      </section>`;
    document.body.appendChild(modal);

    const select = modal.querySelector('select[name="projectId"]');
    const sortedProjects = [...projects].sort((a, b) =>
      String(a.unit || a.projectName || '').localeCompare(String(b.unit || b.projectName || ''), 'pt-BR'),
    );

    select.insertAdjacentHTML('beforeend', sortedProjects.map((item) => {
      const id = String(item.sultsProjectId || item.id || '');
      const unit = item.unit || item.projectName || 'Unidade sem nome';
      return `<option value="${esc(id)}">${esc(unit)}</option>`;
    }).join(''));

    select.addEventListener('change', () => {
      const selected = projects.find((item) =>
        String(item.sultsProjectId || item.id || '') === String(select.value),
      );
      if (!selected) return;
      modal.querySelector('input[name="unit"]').value = selected.unit || selected.projectName || '';
      modal.querySelector('input[name="responsible"]').value = selected.responsible || '';
      modal.querySelector('input[name="location"]').value = selected.category || selected.model || '';
      modal.querySelector('input[name="openingDate"]').value = '';
    });

    modal.querySelectorAll('[data-pmh-independent-close]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });

    modal.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const projectId = String(data.get('projectId') || '');
      const tracked = readTracked();
      const existing = projectId && tracked.some((item) =>
        String(item.sourceProjectId || '') === projectId,
      );

      if (existing) {
        window.alert('Essa unidade já possui uma inauguração em acompanhamento.');
        return;
      }

      tracked.unshift({
        id: `inauguration-${Date.now()}`,
        sourceProjectId: projectId || null,
        unit: String(data.get('unit') || '').trim(),
        openingDate: String(data.get('openingDate') || ''),
        responsible: String(data.get('responsible') || '').trim(),
        location: String(data.get('location') || '').trim(),
        packageBudget: 4100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        checklist: makeChecklist(),
      });

      writeTracked(tracked);
      closeModal();
      window.setTimeout(refreshInaugurations, 120);
    });

    return modal;
  };

  const openModal = async () => {
    try {
      const projects = await loadProjects();
      const dialog = ensureModal(projects);
      dialog.querySelector('form').reset();
      dialog.hidden = false;
      document.body.style.overflow = 'hidden';
      window.setTimeout(() => dialog.querySelector('select')?.focus(), 20);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-pmh-new-inauguration]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openModal();
  }, true);

  document.addEventListener('keydown', (event) => {
    const trigger = event.target.closest?.('[data-pmh-new-inauguration]');
    if (!trigger || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openModal();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
  });
})();
