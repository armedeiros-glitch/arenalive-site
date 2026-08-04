(() => {
  const root = document.getElementById('root');
  if (!root) return;

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const smallestMatch = (selector, terms) => {
    const matches = [...root.querySelectorAll(selector)].filter((node) => {
      const text = normalize(node.textContent);
      return terms.every((term) => text.includes(term));
    });
    return matches.sort((a, b) => a.textContent.length - b.textContent.length)[0] || null;
  };

  let announced = false;
  const clean = () => {
    const sidebar = smallestMatch('aside, nav, section, div', [
      'entrada',
      'demandas e aprovacoes',
      'indicadores',
    ]);

    const topbar = smallestMatch('header, section, div', [
      'receber dados',
      'exportar dados',
      'publicar material',
    ]);

    if (sidebar) {
      sidebar.classList.add('pmh-native-hidden');
      if (sidebar.parentElement) sidebar.parentElement.classList.add('pmh-native-layout');
    }

    if (topbar) topbar.classList.add('pmh-native-hidden');

    const main = root.querySelector('main') || topbar?.parentElement || sidebar?.nextElementSibling;
    if (main) main.classList.add('pmh-native-main');

    if (!announced && root.children.length) {
      announced = true;
      window.parent?.postMessage({ type: 'pmh-native-ready' }, window.location.origin);
    }
  };

  const observer = new MutationObserver(clean);
  observer.observe(root, { childList: true, subtree: true });
  clean();
})();
