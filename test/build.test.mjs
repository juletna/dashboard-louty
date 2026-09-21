import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildArtifact } from '../scripts/build.mjs';
import { assertNoExternalActiveResources } from '../scripts/offline-check.mjs';

test('build is deterministic and preserves the checked-in standalone page', () => {
  const first = buildArtifact();
  const second = buildArtifact();
  assert.deepEqual(first, second);
  assert.equal(first.html, readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
  assert.equal(first.version, readFileSync(new URL('../version.txt', import.meta.url), 'utf8'));
});

test('offline check blocks protocol-relative active resources', () => {
  assert.throws(() => assertNoExternalActiveResources('<img src="//cdn.example/image.png">', '', ''), /HTML/);
  assert.throws(() => assertNoExternalActiveResources('', 'a{background:url(//cdn.example/image.png)}', ''), /CSS/);
  assert.throws(() => assertNoExternalActiveResources('', '', "fetch('//cdn.example/data')"), /application/);
  assert.doesNotThrow(() => assertNoExternalActiveResources('', '/* url(//license.example) */', ''));
});
