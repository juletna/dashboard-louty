import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderCapProjections, revenueProjectionHelp, salaryCapacityHelp } from '../src/app/views/annual-cap.js';
import { salaryCapacityAtDate } from '../src/app/domain/annual-cap.js';

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
  assert.equal((host.innerHTML.match(/sp-help/g) || []).length, 2);
  assert.match(host.innerHTML, /Détail du calcul de la projection du chiffre d’affaires/);
});
