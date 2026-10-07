import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareDocuments, matchQuotes, reconcileForecast, forecastSummary } from '../src/app/domain/forecast.js';
import { createForecastStorage, FORECAST_KEY } from '../src/app/state/forecast.js';
import { parseExportDate } from '../src/app/state/import.js';
import { parsePieces } from '../src/app/parser.js';

function doc(number, amount, type = 'Devis', extra = {}) {
  return { number, amount, type, client_id: '001', client: 'Client fictif', activity: 'ACT',
    date: type === 'Devis' ? '2026-01-01' : '2026-02-01', title: number, state: 'Validé & imp.', ...extra };
}
const match = input => matchQuotes(prepareDocuments(input));
const choice = (row, extra = {}) => ({ action: 'include', quote: row, fingerprint: row.fingerprint,
  remaining: 100, situation: 'confirmed', month: '2026-10', ...extra });

test('matching excludes drafts but never relies on agreement or validation status', () => {
  const result = match([doc('draft', 12, 'Devis', { state: 'Brouillon' }), doc('q', 100, 'Devis', { state: 'Attente valid.' }), doc('f', 100, 'Facture', { state: 'Ancien état' })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'complete');
});
test('missing client IDs and different activity never match by client name', () => {
  assert.equal(match([doc('q', 100, 'Devis', { client_id: '' }), doc('f', 100, 'Facture', { client_id: '' })])[0].status, 'no-id');
  assert.equal(match([doc('q', 100), doc('f', 100, 'Facture', { activity: 'OTHER' })])[0].status, 'unmatched');
});
test('elimination allocates each invoice once, exact before partial sums', () => {
  const rows = match([doc('q1', 100), doc('q2', 500), doc('f1', 100, 'Facture'), doc('f2', 150, 'Facture de situation'), doc('f3', 200, 'Facture de situation')]);
  assert.equal(rows[0].status, 'complete');
  assert.equal(rows[1].status, 'partial');
  assert.equal(rows[1].proposed, 150);
  assert.equal(new Set(rows.flatMap(r => r.matched.map(b => b.key))).size, 3);
  const reversed = match([doc('f3', 200, 'Facture de situation'), doc('q2', 500), doc('f2', 150, 'Facture de situation'), doc('q1', 100), doc('f1', 100, 'Facture')]);
  assert.equal(reversed.find(r => r.number === 'q2').proposed, 150);
});
test('duplicate amounts and competing quotes stay ambiguous and cannot donate their invoice', () => {
  const rows = match([doc('q1', 100), doc('q2', 100), doc('q3', 200), doc('f', 100, 'Facture')]);
  assert.ok(rows.every(r => r.status === 'ambiguous' && r.eligible));
});
test('deposits, credits, invalid invoices and prior invoices never silently reduce a quote', () => {
  for (const extra of [doc('a', 40, "Facture d'acompte"), doc('a', -20, 'Avoir'), doc('a', null, 'Facture'), doc('a', 30, 'Facture', { date: null })]) {
    const r = match([doc('q', 100), doc('f', 40, 'Facture'), extra])[0];
    assert.equal(r.status, 'ambiguous'); assert.equal(r.proposed, 100);
  }
  assert.equal(match([doc('q', 100), doc('f', 100, 'Facture', { date: '2025-12-01' })])[0].status, 'unmatched');
});
test('cent rounding, identical document IDs and unnumbered identities are deterministic', () => {
  assert.equal(match([doc('q', .3), doc('f1', .1, 'Facture'), doc('f2', .2, 'Facture')])[0].status, 'complete');
  const duplicates = match([doc('q', 100), doc('q', 100), doc('f', 100, 'Facture')]);
  assert.equal(duplicates.length, 1); assert.equal(duplicates[0].status, 'ambiguous');
  assert.notEqual(prepareDocuments([doc('', 100)])[0].key, prepareDocuments([doc('', 200)])[0].key);
});
test('choices survive reordered imports, changed invoices require review, missing quotes remain inspectable', () => {
  const input = [doc('q', 100), doc('f', 30, 'Facture')];
  const row = match(input)[0], choices = new Map([[row.key, choice(row)]]);
  assert.equal(reconcileForecast(prepareDocuments([...input].reverse()), choices)[0].review, false);
  const changed = reconcileForecast(prepareDocuments([...input, doc('f2', 20, 'Facture')]), choices)[0];
  assert.equal(changed.review, true); assert.equal(changed.choice.remaining, 100);
  const missing = reconcileForecast([], choices)[0];
  assert.equal(missing.missing, true); assert.equal(missing.choice.remaining, 100);
});
test('annual forecast separates waits, undated, covered months, other years and stale selections', () => {
  const documents = prepareDocuments(Array.from({ length: 6 }, (_, i) => doc('q' + i, 100, 'Devis', { client_id: String(i) })));
  const r = matchQuotes(documents);
  const choices = new Map(r.map((q, i) => [q.key, choice(q, [ {}, { situation: 'waiting' }, { month: null }, { month: '2026-09' }, { month: '2027-01' }, { fingerprint: 'stale' } ][i])]));
  const data = { years: { 2026: { monthly: { ca: [100, null, 200] }, months_present: [1,2,3,4,5,6,7,8,9] } }, snapshot: { current: { year: '2026' } } };
  const s = forecastSummary(reconcileForecast(documents, choices), data, 1000);
  assert.equal(s.confirmed, 400); assert.equal(s.waiting, 100); assert.equal(s.undated, 100);
  assert.equal(s.annualConfirmed, 100); assert.equal(s.actual, 300); assert.equal(s.actualPlusConfirmed, 400);
  assert.equal(s.gap, 600); assert.equal(s.reviewCount, 1); assert.equal(s.coveredCount, 1);
  assert.equal(s.monthly[9], 100); assert.equal(s.monthly[8], null);
  data.years[2026].monthly.ca.fill(null);
  assert.equal(forecastSummary([], data, 1000).actualPlusConfirmed, null);
});
test('forecast storage preserves zero, reloads choices, does not overwrite corrupt cache, reports quota errors', () => {
  let raw = null, fail = false;
  const memory = { getItem: () => raw, setItem: (key, value) => { assert.equal(key, FORECAST_KEY); if (fail) throw Error('quota'); raw = value; } };
  const row = match([doc('q', 100)])[0];
  const s = createForecastStorage(memory);
  assert.equal(s.set(row.key, choice(row, { remaining: 0 })), true);
  assert.equal(createForecastStorage(memory).choices.get(row.key).remaining, 0);
  const old = raw; fail = true;
  assert.equal(s.set(row.key, choice(row, { remaining: 50 })), false);
  assert.equal(raw, old); assert.equal(s.choices.get(row.key).remaining, 50); assert.ok(s.warning);
  fail = false; raw = 'corrupt'; const corrupt = createForecastStorage(memory);
  assert.equal(corrupt.set(row.key, choice(row)), false); assert.equal(raw, 'corrupt');
});
test('Pieces filenames without underscore supply an export date', () => {
  assert.ok(parseExportDate('Pieces261007_131213.xlsx'));
});
test('parser retains unnumbered waiting quotes, missing fields and ID zero, excludes drafts', () => {
  const cells = [
    ['Type','Date','Client','Montant H.T.','Etat','N° client','Numéro chrono'],
    ['Devis','2026-01-01','Fictif',100,'Attente valid.',0,''],
    ['Devis','','Fictif','','Validé & imp.','','MISSING'],
    ['Devis','2026-01-01','Fictif',100,'Brouillon','1','DRAFT'],
  ];
  const sheet = { '!ref': 'A1:G4' };
  cells.forEach((row, r) => row.forEach((v, c) => sheet[`${r}:${c}`] = { v }));
  const XLSX = { utils: { decode_range: () => ({ e: { r: 3, c: 6 } }), encode_cell: ({ r,c }) => `${r}:${c}` } };
  const out = parsePieces(XLSX, { SheetNames: ['P'], Sheets: { P: sheet } });
  assert.equal(out.documents.length, 2); assert.equal(out.documents[0].client_id, '0');
  assert.equal(out.documents[1].amount, null); assert.equal(out.documents[1].date, null);
});
