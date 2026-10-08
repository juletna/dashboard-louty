import assert from 'node:assert/strict';
import { test } from 'node:test';
import { salaryCapacityHelp } from '../src/app/views/annual-cap.js';
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
