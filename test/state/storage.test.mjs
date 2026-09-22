import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDataStorage, DATA_KEY } from '../../src/app/state/storage.js';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (key, next) => { assert.equal(key, DATA_KEY); value = next; },
    value: () => value,
  };
}

test('legacy v1 JSON loads without changing its key or shape', () => {
  const data = { years: { 2025: { monthly: { ca: [null, 0] } } }, labels_missing: ['charges_fonct'] };
  const storage = memoryStorage(JSON.stringify(data));
  const adapter = createDataStorage(storage, (candidate) => { assert.ok(candidate.years); return candidate; });
  assert.deepEqual(adapter.loadData(), { status: 'ready', data });
  assert.equal(storage.value(), JSON.stringify(data));
});

test('invalid saved data is reported but never removed', () => {
  const storage = memoryStorage('{bad');
  const adapter = createDataStorage(storage, () => {});
  assert.equal(adapter.loadData().status, 'invalid');
  assert.equal(storage.value(), '{bad');
});

test('failed storage write preserves the old cache', () => {
  const storage = memoryStorage('{"old":true}');
  storage.setItem = () => { throw new Error('quota'); };
  const adapter = createDataStorage(storage, () => {});
  assert.equal(adapter.saveData({ new: true }).ok, false);
  assert.equal(storage.value(), '{"old":true}');
});

test('storage writes only the existing v1 fields', () => {
  const storage = memoryStorage();
  const adapter = createDataStorage(storage, () => {});
  assert.equal(adapter.saveData({ years: { 2026: {} }, snapshot: { transient: true }, res_name: 'RES.xlsx' }).ok, true);
  assert.deepEqual(JSON.parse(storage.value()), { years: { 2026: {} }, res_name: 'RES.xlsx' });
});

test('load uses the normalized data returned by schema validation', () => {
  const storage = memoryStorage('{"years":{"2026":{}}}');
  const adapter = createDataStorage(storage, (data) => ({ ...data, labels_missing: [] }));
  assert.deepEqual(adapter.loadData().data.labels_missing, []);
});
