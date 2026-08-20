import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

globalThis.window = { addEventListener() {} };
globalThis.document = {
  readyState: 'complete',
  querySelector() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {},
};
globalThis.location = { hash: '' };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

await import('../planet-hub/assets/planet-five-stars-actions-v1.js');
const guidance = globalThis.window.PlanetFiveStarsGuidance;
assert.ok(guidance?.biggestGap && guidance?.firstOpenPlan && guidance?.unitGuidance);

const proportional = guidance.biggestGap({ scores: { commercial: 28, experience: 25, marketing: 12, management: 20 } });
assert.equal(proportional.pillar, 'marketing');
assert.equal(proportional.score, 12);
assert.equal(proportional.max, 20);

const notAbsolute = guidance.biggestGap({ scores: { commercial: 20, experience: 25, marketing: 10, management: 20 } });
assert.equal(notAbsolute.pillar, 'marketing', 'Gap proporcional deve vencer diferença absoluta maior em Comercial.');

const tied = guidance.biggestGap({ scores: { commercial: 28, experience: 20, marketing: 16, management: 16 } });
assert.equal(tied.pillar, 'commercial', 'Empate deve respeitar a ordem oficial dos pilares.');
assert.equal(guidance.biggestGap(null), null);

const base = (id, status, deadline, updatedAt = '2026-08-13T10:00:00.000Z') => ({
  id, unit: 'Planet Teste', title: id, status, deadline, updatedAt, createdAt: '2026-08-01T10:00:00.000Z', ownerArea: 'marketing',
});
const plans = [
  base('sem-prazo', 'aberto', ''),
  base('futuro', 'aberto', '2026-08-20'),
  base('hoje', 'em_andamento', '2026-08-13'),
  base('atrasado-recente', 'aberto', '2026-08-12'),
  base('atrasado-antigo', 'aberto', '2026-08-10'),
  base('concluido', 'concluido', '2026-08-01'),
];
assert.equal(guidance.firstOpenPlan('Planet Teste', plans, '2026-08-13').id, 'atrasado-antigo');
assert.equal(guidance.firstOpenPlan('Planet Teste', plans.filter((p) => !p.id.startsWith('atrasado')), '2026-08-13').id, 'hoje');
assert.equal(guidance.firstOpenPlan('Planet Teste', plans.filter((p) => ['futuro', 'sem-prazo'].includes(p.id)), '2026-08-13').id, 'futuro');
assert.equal(guidance.firstOpenPlan('Planet Teste', [base('a', 'aberto', ''), base('b', 'concluido', '2026-08-01')]).id, 'a');
assert.equal(guidance.firstOpenPlan('Outra Unidade', plans), null);

const afterConclusion = plans.map((plan) => plan.id === 'atrasado-antigo' ? { ...plan, status: 'concluido' } : plan);
assert.equal(guidance.firstOpenPlan('Planet Teste', afterConclusion).id, 'atrasado-recente');

const oldEvaluation = { scores: { commercial: 35, experience: 25, marketing: 10, management: 20 } };
const newEvaluation = { scores: { commercial: 18, experience: 25, marketing: 20, management: 20 } };
assert.equal(guidance.unitGuidance('Planet Teste', oldEvaluation, []).gap.pillar, 'marketing');
assert.equal(guidance.unitGuidance('Planet Teste', newEvaluation, []).gap.pillar, 'commercial');
assert.equal(guidance.unitGuidance('Planet Teste', null, []).gap, null);
assert.equal(guidance.unitGuidance('Planet Teste', newEvaluation, []).plan, null);

const [source, css, evaluationsApi, plansApi, radar] = await Promise.all([
  readFile(new URL('../planet-hub/assets/planet-five-stars-actions-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/planet-five-stars-actions-v1.css', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/hub/planet/five-stars/evaluations.js', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/hub/planet/five-stars/action-plans.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/radar-data-v1.js', import.meta.url), 'utf8'),
]);
assert.match(source, /MAIOR OPORTUNIDADE/);
assert.match(source, /AÇÃO PENDENTE/);
assert.match(source, /Sem avaliação registrada/);
assert.match(source, /Nenhuma ação pendente/);
assert.match(source, /ATRASADA/);
assert.match(source, /unitGuidance\(unit, evaluation, state\.plans\)/);
assert.match(source, /\['aberto', 'em_andamento'\]\.includes\(plan\.status\)/);
assert.match(source, /if \(selectedTab\(\) === 'units'\) decorateUnitRows\(\)/);
assert.match(css, /\.p5-unit-guidance/);
assert.match(css, /text-overflow:ellipsis/);
assert.doesNotMatch(evaluationsApi, /biggestGap|weakestPillar|nextAction|attention|overdue/);
assert.doesNotMatch(plansApi, /biggestGap|weakestPillar|nextAction|attention|overdue/);
assert.match(evaluationsApi, /planet-hub:planet-five-stars-evaluation:v1:/);
assert.match(plansApi, /planet-hub:planet-five-stars-action-plan:v1:/);
assert.doesNotMatch(radar, /five-stars|5-estrelas|Planet 5 Estrelas/);

console.log('Planet 5 Estrelas: orientação operacional por unidade validada.');
