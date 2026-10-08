import assert from 'node:assert/strict';
import { test } from 'node:test';
import { projectedResultHelp, renderCapProjections, revenueProjectionHelp, salaryCapacityHelp } from '../src/app/views/annual-cap.js';
import { projectedPlanResultDetail, salaryCapacityAtDate } from '../src/app/domain/annual-cap.js';

const tools = { money:(v) => Math.round(v) + ' €', escape:(v) => String(v).replace(/</g, '&lt;') };
const year = { months_present:[1,2,3,4], monthly:{ marge_brute:[1000,1000,1000,1000], charges_fonct:[100,120,110,10], contribution_coop:[0,0,0,0] } };

test('help shows period, calculation lines and the incomplete-month warning', () => {
  const html = salaryCapacityHelp(salaryCapacityAtDate(year, '2026', 4, '2026-04-15', 0.65, 0.1), tools);
  assert.match(html, /1er janv\. → 15 avr\. 2026/);
  assert.match(html, /Contribution \(estimée\)/);
  assert.match(html, /Avril semble incomplet/);
  assert.match(html, /≈ \d+ € net \/ mois/);
});
test('help reports unavailable and deficit cases', () => {
  assert.match(salaryCapacityHelp(salaryCapacityAtDate(year, '2026', 4, null, 0.65), tools), /Calcul indisponible/);
  const deficit = { months_present:[1], monthly:{ marge_brute:[100], charges_fonct:[300], contribution_coop:[0] } };
  assert.match(salaryCapacityHelp(salaryCapacityAtDate(deficit, '2026', 1, '2026-02-10', 0.65), tools), /déficit de 200 €/);
});
test('completed period is labelled by month end without warning when charges are normal', () => {
  const normal = { ...year, monthly:{ ...year.monthly, charges_fonct:[100,120,110,90] } };
  const html = salaryCapacityHelp(salaryCapacityAtDate(normal, '2026', 4, '2026-09-01', 0.65), tools);
  assert.match(html, /→ fin avril 2026 · 4 mois/);
  assert.doesNotMatch(html, /semble incomplet/);
});

const projection = { end:9, actualCA:80000, futureCA:12000, totalCA:92000 };
const revenueArgs = { projection, year:'2026', exportIso:'2026-10-05T10:00:00', quotes:{ confirmed:4, waiting:3000, validation:0, review:2 } };

test('revenue help shows the covered periods, the calculation and the excluded quotes', () => {
  const html = revenueProjectionHelp(revenueArgs, tools);
  assert.match(html, /Réalisé janv\. → sept\. 2026 \(export du 05\/10\) · estimé oct\. → déc\./);
  assert.match(html, /\+ Reste à facturer \(4 devis\)/);
  assert.match(html, /= Projection.*92000 €/);
  assert.match(html, /Non comptés : en attente 3000 € · 2 à examiner/);
  assert.doesNotMatch(html, /à valider/);
});
test('revenue help for a closed exercise shows no remaining billing', () => {
  const html = revenueProjectionHelp({ ...revenueArgs, projection:{ end:12, actualCA:90000, futureCA:0, totalCA:90000 } }, tools);
  assert.match(html, /janv\. → déc\. 2026/);
  assert.doesNotMatch(html, /estimé|Reste à facturer/);
});
test('revenue help reports an unavailable projection', () => {
  assert.match(revenueProjectionHelp({ ...revenueArgs, projection:null }, tools), /Calcul indisponible/);
});
test('cap cards render the revenue help on the revenue card only', () => {
  const host = { innerHTML:'' };
  renderCapProjections(host, { year:'2026', salary:2000, result:1, margin:2, revenue:3, goals:{ salary:1, result:1, margin:1, revenue:1 }, salaryHelp:'<b>s</b>', revenueHelp:'<b>r</b>' }, tools);
  assert.equal((host.innerHTML.match(/sp-help/g) || []).length, 2); // salary + revenue; result help not passed here
  assert.match(host.innerHTML, /Détail du calcul de la projection du chiffre d’affaires/);
});

const plan = { salary:30000, charges:15000, surplus:5000 };
const resultProjection = { end:8, actualMB:40000, futureCA:20000, rate:0.5, reference:'2024 et 2025' };
const resultArgs = { detail:projectedPlanResultDetail(60000, plan, 0.1), projection:resultProjection, year:'2026' };

test('result help shows the period, the calculation lines, the margin build-up and the contribution adjustment', () => {
  const html = projectedResultHelp(resultArgs, tools);
  assert.match(html, /Réalisé janv\. → août 2026 · estimé sept\. → déc\./);
  assert.match(html, /Marge brute projetée.*60000 €/);
  assert.match(html, /− Salaire brut prévu \(12 mois\).*30000 €/);
  assert.match(html, /− Ajustement contribution.*1000 €/);
  assert.match(html, /= Résultat projeté.*14000 €/);
  assert.match(html, /40000 € réalisés \+ 20000 € HT à venir × 50 % \(moy\. 2024 et 2025\)/);
  assert.match(html, /10 % × l’écart de marge avec le plan \(10000 €\)/);
  assert.match(html, /≈ 14000 € d’excédent/);
});
test('result help flags a deficit, a negative adjustment and omits the adjustment without a rate', () => {
  const low = projectedResultHelp({ ...resultArgs, detail:projectedPlanResultDetail(40000, plan, 0.1) }, tools);
  assert.match(low, /\+ Ajustement contribution.*1000 €/);
  assert.match(low, /≈ 4000 € de déficit/);
  const none = projectedResultHelp({ ...resultArgs, detail:projectedPlanResultDetail(60000, plan, null) }, tools);
  assert.doesNotMatch(none, /Ajustement/);
});
test('result help for a closed exercise adds no remaining billing and reports unavailable data', () => {
  const closed = projectedResultHelp({ ...resultArgs, projection:{ ...resultProjection, end:12, futureCA:0 } }, tools);
  assert.match(closed, /janv\. → déc\. 2026/);
  assert.doesNotMatch(closed, /estimé|à venir/);
  assert.match(projectedResultHelp({ ...resultArgs, detail:null }, tools), /Calcul indisponible/);
  assert.match(projectedResultHelp({ ...resultArgs, projection:null }, tools), /Calcul indisponible/);
});
test('result help omits the remaining billing line when nothing is left to invoice', () => {
  const html = projectedResultHelp({ ...resultArgs, projection:{ ...resultProjection, futureCA:0 } }, tools);
  assert.match(html, /Marge = 40000 € réalisés\./);
  assert.doesNotMatch(html, /à venir ×/);
});
test('result help escapes imported text', () => {
  const html = projectedResultHelp({ ...resultArgs, projection:{ ...resultProjection, reference:'<img>' } }, tools);
  assert.doesNotMatch(html, /<img>/);
});
test('the result card carries its help button', () => {
  const host = { innerHTML:'' };
  renderCapProjections(host, { year:'2026', salary:2000, result:1, margin:2, revenue:3, goals:{ salary:1, result:1, margin:1, revenue:1 }, resultHelp:'<b>x</b>' }, tools);
  assert.match(host.innerHTML, /Détail du calcul de la projection du résultat/);
});
