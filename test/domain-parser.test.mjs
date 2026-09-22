import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertValidDashboardData,
  isCompleteHistoricalYear,
  normalizeDashboardData,
} from '../src/app/domain/schema.js';
import { computeSnapshot, historicalPlanReference } from '../src/app/domain/metrics.js';
import { TARGET_LABELS, parsePieces, parsePiecesDate, parseRES } from '../src/app/parser.js';

const C = {
  MB_MIN: 100,
  CA_OBJ: 1000,
  TAUX_OBJ: 0.4,
  RATIO_CIBLE: 0.3,
  MB_AN_OBJ: 1200,
};

const metricKeys = ['ca', 'marge_brute', 'achats_matieres', 'remunerations', 'charges_fonct', 'contribution_coop'];

function completeYear(value = 100, months = 12) {
  const monthly = {};
  metricKeys.forEach((key) => { monthly[key] = Array.from({ length: 12 }, (_, index) => index < months ? value : null); });
  return { monthly, months_present: Array.from({ length: months }, (_, index) => index + 1) };
}

test('legacy cache with nulls and missing labels remains structurally valid', () => {
  const result = normalizeDashboardData({
    years: { '2025': { monthly: { ca: [100, null], marge_brute: [40, null] }, months_present: [1, 2] } },
    labels_missing: ['remunerations'],
  });
  assert.equal(result.valid, true);
  assert.equal(result.data.years['2025'].monthly.ca.length, 12);
  assert.deepEqual(result.data.labels_missing, ['remunerations']);
  assert.throws(() => assertValidDashboardData({ years: { '2025': { monthly: { ca: 'invalid' } } } }));
});

test('rejects every malformed year without dropping it while keeping partial years valid', () => {
  const mixed = normalizeDashboardData({
    years: {
      '2025': { monthly: { ca: [100] }, months_present: [1] },
      '2026': { monthly: { ca: 'invalid' }, months_present: [1] },
    },
  });
  assert.equal(mixed.valid, false);
  assert.deepEqual(mixed.errors, ['invalid_series:2026:ca']);
  assert.throws(() => assertValidDashboardData({
    years: {
      '2025': { monthly: { ca: [100] }, months_present: [1] },
      '2026': { monthly: { ca: 'invalid' }, months_present: [1] },
    },
  }));

  const partial = normalizeDashboardData({
    years: { '2025': { monthly: { ca: [100] }, months_present: [1] } },
  });
  assert.equal(partial.valid, true);
  assert.equal(partial.data.years['2025'].monthly.ca[0], 100);
});

test('rejects a null monthly structure without throwing during normalization', () => {
  const result = normalizeDashboardData({ years: { '2025': { monthly: null } } });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ['invalid_year:2025', 'no_valid_year']);
  assert.throws(() => assertValidDashboardData({ years: { '2025': { monthly: null } } }));
});

test('complete historical year requires all months and all reference metrics', () => {
  const full = completeYear();
  assert.equal(isCompleteHistoricalYear(full), true);
  full.monthly.ca[5] = null;
  assert.equal(isCompleteHistoricalYear(full), false);
  full.monthly.ca[5] = 100;
  full.months_present.pop();
  assert.equal(isCompleteHistoricalYear(full), false);
});

test('snapshot only projects from complete historical years', () => {
  const data = {
    years: {
      '2023': completeYear(100),
      '2024': completeYear(200),
      '2025': completeYear(300, 2),
    },
  };
  const snapshot = computeSnapshot(data, C);
  assert.equal(snapshot.mois_renseignes, 2);
  assert.deepEqual(snapshot.reference_years, ['2023', '2024']);
  assert.equal(snapshot.projection_mb_seasonal, 2100);
  data.years['2024'].monthly.ca[6] = null;
  const afterHole = computeSnapshot(data, C);
  assert.deepEqual(afterHole.reference_years, ['2023']);
  assert.equal(afterHole.projection_ca_seasonal, 1600);
});

test('snapshot reaches older complete history and never invents a rate from missing margin', () => {
  const data = {
    years: {
      '2021': completeYear(100),
      '2022': completeYear(100, 11),
      '2023': completeYear(100, 11),
      '2024': completeYear(100, 2),
    },
  };
  assert.deepEqual(computeSnapshot(data, C).reference_years, ['2021']);

  const noMargin = completeYear(100, 1);
  noMargin.monthly.marge_brute.fill(null);
  const snapshot = computeSnapshot({ years: { '2024': completeYear(100), '2025': noMargin } }, C);
  assert.equal(snapshot.taux_mb, null);
  assert.equal(snapshot.growth_rate_mb, null);
});

test('historical plan excludes partial years and preserves real zero values', () => {
  const partial = completeYear(100, 11);
  const data = { years: { '2023': completeYear(50), '2024': partial, '2025': completeYear(75, 2) } };
  const reference = historicalPlanReference(data, C);
  assert.deepEqual(reference.years, ['2023']);

  const zero = completeYear(0);
  const zeroReference = historicalPlanReference({ years: { '2025': zero } }, C);
  assert.equal(zeroReference.salary, 0);
  assert.equal(zeroReference.ca, 0);
  assert.equal(zeroReference.charges, 0);

  const fallback = historicalPlanReference({ years: { '2025': partial } }, C);
  assert.equal(fallback.label, 'historique indisponible');
  assert.equal(fallback.salary, C.MB_MIN * 12);
});

test('parser preserves missing RES labels and rejects null dates without epoch fallback', () => {
  const rows = [[], [], ['Libellé', 'Janv-25']];
  rows.push([TARGET_LABELS.ca, 100]);
  const parsed = parseRES(null, rows);
  assert.equal(parsed.years['2025'].monthly.ca[0], 100);
  assert.ok(parsed.labels_missing.includes('marge_brute'));
  assert.equal(parsePiecesDate(null), null);
  assert.equal(parsePiecesDate(''), null);
  assert.equal(parsePiecesDate(0), null);
  assert.equal(parsePiecesDate('pas une date'), null);
  assert.equal(parsePiecesDate(new Date('2025-01-01T00:00:00Z')).toISOString(), '2025-01-01T00:00:00.000Z');
});

test('Pièces accepts prototype-like customer names as normal records', () => {
  const rows = [
    ['Type', 'Date', 'Client', 'Montant H.T.', 'Etat'],
    ['Facture', new Date('2025-01-15T00:00:00Z'), '__proto__', 120, 'Confirmé'],
    ['Facture', new Date('2025-01-16T00:00:00Z'), 'constructor', 80, 'Confirmé'],
  ];
  const sheet = { '!ref': 'A1:E3' };
  rows.forEach((row, rowIndex) => row.forEach((value, columnIndex) => { sheet[`${rowIndex}:${columnIndex}`] = { v: value }; }));
  const XLSX = {
    utils: {
      decode_range: () => ({ e: { r: 2, c: 4 } }),
      encode_cell: ({ r, c }) => `${r}:${c}`,
    },
  };
  const result = parsePieces(XLSX, { SheetNames: ['Rapport'], Sheets: { Rapport: sheet } });
  assert.deepEqual(result.by_year['2025'].clients.map((client) => client.label).sort(), ['__proto__', 'constructor']);
});
