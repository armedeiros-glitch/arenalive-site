(() => {
  let currentPage = 0;
  let pageSize = 4;
  let currentBoard = null;
  let controls = null;
  let rendering = false;

  const calculatePageSize = () => {
    const width = document.querySelector('[data-pmh-content]')?.clientWidth || window.innerWidth;
    if (width < 620) return 1;
    if (width < 900) return 2;
    if (width < 1180) return 3;
    return 4;
  };

  const setText = (element, value) => {
    if (element && element.textContent !== value) element.textContent = value;
  };

  const setDisabled = (element, value) => {
    if (element && element.disabled !== value) element.disabled = value;
  };

  const renderPage = () => {
    if (rendering || !currentBoard || !document.body.contains(currentBoard)) return;

    const lanes = [...currentBoard.querySelectorAll('.pmh-kanban-lane')];
    if (!lanes.length) return;

    rendering = true;
    try {
      pageSize = calculatePageSize();
      const totalPages = Math.max(1, Math.ceil(lanes.length / pageSize));
      currentPage = Math.min(currentPage, totalPages - 1);

      const start = currentPage * pageSize;
      const end = start + pageSize;

      currentBoard.classList.add('is-paginated');
      currentBoard.style.setProperty('--pmh-kanban-columns', String(Math.min(pageSize, lanes.length)));

      lanes.forEach((lane, index) => {
        const shouldHide = index < start || index >= end;
        if (lane.hidden !== shouldHide) lane.hidden = shouldHide;
      });

      if (!controls || !document.body.contains(controls)) return;
      setText(
        controls.querySelector('[data-kanban-page]'),
        `Página ${currentPage + 1} de ${totalPages}`,
      );
      setDisabled(controls.querySelector('[data-kanban-prev]'), currentPage === 0);
      setDisabled(
        controls.querySelector('[data-kanban-next]'),
        currentPage >= totalPages - 1,
      );
      if (controls.hidden !== (totalPages <= 1)) controls.hidden = totalPages <= 1;
    } finally {
      rendering = false;
    }
  };

  const ensureControls = (board) => {
    if (board.dataset.paginationReady === '1') {
      currentBoard = board;
      controls = board.previousElementSibling?.classList.contains('pmh-kanban-pagination')
        ? board.previousElementSibling
        : document.querySelector('.pmh-kanban-pagination');
      renderPage();
      return;
    }

    board.dataset.paginationReady = '1';
    currentBoard = board;
    currentPage = 0;

    controls = document.createElement('div');
    controls.className = 'pmh-kanban-pagination';
    controls.innerHTML = `
      <button type="button" data-kanban-prev aria-label="Página anterior">‹</button>
      <span data-kanban-page>Página 1 de 1</span>
      <button type="button" data-kanban-next aria-label="Próxima página">›</button>`;

    controls.addEventListener('click', (event) => {
      if (event.target.closest('[data-kanban-prev]')) {
        currentPage = Math.max(0, currentPage - 1);
        renderPage();
      }
      if (event.target.closest('[data-kanban-next]')) {
        currentPage += 1;
        renderPage();
      }
    });

    board.before(controls);
    renderPage();
  };

  const scan = () => {
    if (rendering) return;
    const board = document.querySelector('.pmh-kanban');
    if (board) ensureControls(board);
  };

  const observer = new MutationObserver((mutations) => {
    const hasRelevantChange = mutations.some((mutation) =>
      [...mutation.addedNodes].some((node) =>
        node.nodeType === 1 && (
          node.matches?.('.pmh-kanban, .pmh-kanban *') ||
          node.querySelector?.('.pmh-kanban')
        ),
      ),
    );
    if (hasRelevantChange) scan();
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', renderPage);
  scan();
})();
