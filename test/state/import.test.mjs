import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDashboardStore } from '../../src/app/state/store.js';
import { createImportController, prepareImportCandidate, publishImportCandidate } from '../../src/app/state/import.js';

const book = (name) => ({ name, wb: { name } });
const parsers = {
  parseRES: () => ({ years: { 2026: { monthly: { ca: [12] } } }, sante: { stale: true }, bal_name: 'old.xlsx' }),
  parseBAL: () => ({ cash: 50 }),
  parsePieces: () => ({ clients: ['A'] }),
};

test('new RES clears old optional exports and derives names and dates', () => {
  const prior = { years: { 2025: {} }, sante: { cash: 2 } };
  const candidate = prepareImportCandidate(
    { resBook: book('RES_260922_101530.xlsx'), balBook: null, piecesBook: null }, prior, parsers,
    () => new Date('2026-09-22T12:00:00Z'),
  );
  assert.equal(candidate.sante, undefined);
  assert.equal(candidate.bal_name, undefined);
  assert.equal(candidate.res_export_iso, new Date(2026, 8, 22, 10, 15, 30).toISOString());
  assert.equal(candidate.file_mtime_iso, '2026-09-22T12:00:00.000Z');
  assert.deepEqual(prior, { years: { 2025: {} }, sante: { cash: 2 } });
});

test('failed Pièces parser does not mutate prior BAL or data', () => {
  const prior = { years: { 2026: {} }, sante: { cash: 2 }, bal_name: 'old.xlsx' };
  assert.throws(() => prepareImportCandidate(
    { resBook: null, balBook: book('BAL.xlsx'), piecesBook: book('PIECES.xlsx') }, prior,
    { ...parsers, parsePieces: () => { throw new Error('bad columns'); } },
  ), /Pièces illisible/);
  assert.deepEqual(prior, { years: { 2026: {} }, sante: { cash: 2 }, bal_name: 'old.xlsx' });
});

test('render failure restores previous view without publishing or saving', async () => {
  const oldData = { years: { 2025: {} } };
  const store = createDashboardStore(oldData);
  let restored = false;
  let saved = false;
  const outcome = await publishImportCandidate({
    candidate: { years: { 2026: {} } },
    derive: () => ({ view: true }),
    capture: () => ({ dom: 'old' }),
    render: () => { throw new Error('chart failure'); },
    restore: (snapshot, previous) => {
      restored = snapshot.dom === 'old' && previous.data === oldData;
    },
    store,
    persistence: { saveData: () => { saved = true; return { ok: true }; } },
  });
  assert.equal(outcome.ok, false);
  assert.equal(restored, true);
  assert.equal(saved, false);
  assert.equal(store.getState().data, oldData);
});

test('render rollback restores the selected year and metric', async () => {
  const store = createDashboardStore({ years: { 2025: {} } });
  const selections = { distributionYear: '2025', pilotageMetric: 'ca' };
  const outcome = await publishImportCandidate({
    candidate: { years: { 2026: {} } },
    derive: () => ({}),
    capture: () => ({ ...selections }),
    render: () => {
      selections.distributionYear = '2026';
      selections.pilotageMetric = 'mb';
      throw new Error('render failed');
    },
    restore: (snapshot) => Object.assign(selections, snapshot),
    store,
    persistence: { saveData: () => { throw new Error('should not save'); } },
  });
  assert.equal(outcome.ok, false);
  assert.deepEqual(selections, { distributionYear: '2025', pilotageMetric: 'ca' });
});

test('invalid candidate is rejected before capture or render', async () => {
  const oldData = { years: { 2025: {} } };
  const store = createDashboardStore(oldData);
  let sideEffects = 0;
  const outcome = await publishImportCandidate({
    candidate: { years: null },
    validate: () => { throw new Error('invalid years'); },
    derive: () => { sideEffects++; },
    capture: () => { sideEffects++; },
    render: () => { sideEffects++; },
    restore: () => { sideEffects++; },
    store,
    persistence: { saveData: () => { sideEffects++; return { ok: true }; } },
  });
  assert.equal(outcome.ok, false);
  assert.equal(sideEffects, 0);
  assert.equal(store.getState().data, oldData);
});

test('quota failure keeps new session data and warns without clearing old cache', async () => {
  const store = createDashboardStore({ old: true });
  const candidate = { new: true };
  let warning = '';
  const outcome = await publishImportCandidate({
    candidate,
    derive: () => ({}),
    capture: () => ({}),
    render: () => {},
    restore: () => {},
    store,
    persistence: { saveData: () => ({ ok: false, error: new Error('quota') }) },
    onWarning: (message) => { warning = message; },
  });
  assert.equal(outcome.ok, true);
  assert.equal(outcome.persisted, false);
  assert.equal(store.getState().data, candidate);
  assert.match(warning, /ne seront pas mémorisées/);
});

test('controller ignores a slower superseded file read', async () => {
  const store = createDashboardStore();
  let finishFirst;
  const firstRead = new Promise((resolve) => { finishFirst = resolve; });
  const controller = createImportController({
    readBook: (file) => file.name === 'first.xlsx' ? firstRead : Promise.resolve(book(file.name)),
    classifyBooks: (books) => ({ resBook: books[0] }),
    parsers: { ...parsers, parseRES: (wb) => ({ years: { 2026: {} }, res_source: wb.name }) },
    validate: (data) => data,
    derive: () => ({}),
    capture: () => ({}),
    render: () => {},
    restore: () => {},
    store,
    persistence: { saveData: () => ({ ok: true }) },
  });
  const slow = controller.ingest([{ name: 'first.xlsx' }]);
  const fast = controller.ingest([{ name: 'second.xlsx' }]);
  await fast;
  finishFirst(book('first.xlsx'));
  assert.equal((await slow).superseded, true);
  assert.equal(store.getState().data.res_source, 'second.xlsx');
});
