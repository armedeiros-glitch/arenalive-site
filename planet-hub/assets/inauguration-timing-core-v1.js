(() => {
  'use strict';

  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
    ? String(value).slice(0, 10)
    : '';

  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const isAndre = (value) => /\bandre\b/.test(normalizeText(value));

  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const shiftIsoDate = (value, days) => {
    const raw = cleanDate(value);
    if (!raw || !Number.isFinite(Number(days))) return '';
    const date = new Date(`${raw}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return '';
    date.setUTCDate(date.getUTCDate() + Number(days));
    return date.toISOString().slice(0, 10);
  };

  const stepDueDate = (item, step) => {
    const override = cleanDate(step?.dueDate);
    if (override) return override;
    if (!cleanDate(item?.openingDate) || !Number.isFinite(Number(step?.daysBefore))) return '';
    return shiftIsoDate(item.openingDate, -Number(step.daysBefore));
  };

  const nextStep = (item, today = todayIso()) => {
    const checklist = Array.isArray(item?.checklist) ? item.checklist : [];
    const pending = checklist.filter((step) => !step?.done);
    if (!pending.length) {
      return { state: 'completed', action: 'Checklist concluído', owner: '', dueDate: '' };
    }

    const candidates = pending.map((step) => ({ step, dueDate: stepDueDate(item, step) }));
    const overdue = candidates.find((entry) => entry.dueDate && entry.dueDate < today);
    const selected = overdue || candidates[0];
    return {
      state: overdue ? 'overdue' : 'pending',
      action: String(selected.step?.action || 'Etapa pendente'),
      owner: String(selected.step?.ownerOverride || selected.step?.owner || ''),
      dueDate: selected.dueDate,
    };
  };

  const ownership = (item, step) => {
    const owner = normalizeText(step?.owner);
    if (isAndre(step?.owner)) return 'mine';
    if (owner.includes('franqueado') && !owner.includes('franqueadora')) return 'tracking';
    if (isAndre(item?.responsible)) return 'mine';
    return 'tracking';
  };

  const dayDiff = (value, today) => {
    const due = cleanDate(value);
    const base = cleanDate(today);
    if (!due || !base) return null;
    const a = Date.parse(`${due}T12:00:00Z`);
    const b = Date.parse(`${base}T12:00:00Z`);
    return Math.round((a - b) / 86400000);
  };

  const attentionItems = (items, today = todayIso()) => (Array.isArray(items) ? items : [])
    .filter((item) => {
      const checklist = Array.isArray(item?.checklist) ? item.checklist : [];
      return !checklist.length || checklist.some((step) => !step?.done);
    })
    .map((item) => {
      const checklist = Array.isArray(item?.checklist) ? item.checklist : [];
      const done = checklist.filter((step) => step?.done).length;
      const next = nextStep(item, today);
      const openingDate = cleanDate(item?.openingDate);
      const dueDate = next.dueDate || openingDate;
      const diff = dayDiff(dueDate, today);
      const postOpening = Boolean(openingDate && openingDate < today);
      const unit = String(item?.unit || 'Inauguração sem unidade');
      const location = String(item?.location || 'Implantação acompanhada');

      return {
        id: `inauguration-${item?.id || unit}`,
        sourceId: String(item?.id || ''),
        origin: 'Inauguração',
        originTone: 'inauguration',
        title: next.state === 'completed' ? unit : `${unit}: ${next.action}`,
        context: location,
        responsible: String(item?.responsible || 'Não definido'),
        ownership: ownership(item, next),
        dueDate,
        openingDate,
        nextAction: next.action || '',
        attentionOwner: next.owner || '',
        status: checklist.length
          ? `${postOpening ? 'Pós-inauguração · ' : ''}${done}/${checklist.length} etapas`
          : (postOpening ? 'Pós-inauguração' : 'Em acompanhamento'),
        priority: next.state === 'overdue' ? 0 : (diff != null && diff <= 7 ? 1 : 3),
        updatedAt: String(item?.updatedAt || ''),
        action: 'inauguracoes',
      };
    });

  window.PMHInaugurationTiming = Object.freeze({
    todayIso,
    stepDueDate,
    nextStep,
    attentionItems,
  });
})();
