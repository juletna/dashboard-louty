// Convertit des exports Louty réels (RES, BAL, Pièces) en JSON de test local.
// Sortie dans test/private/, exclu de Git : ces fichiers contiennent des données clients.
// Usage : node scripts/private-fixture.mjs <RES.xlsx> <BAL.xlsx> <Pieces.xlsx> [nom]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { parseRES, parseBAL, parsePieces } from '../src/app/parser.js';
import { prepareImportCandidate } from '../src/app/state/import.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [resPath, balPath, piecesPath, name = 'latest'] = process.argv.slice(2);
if (!resPath || !balPath || !piecesPath) {
  console.error('Usage : node scripts/private-fixture.mjs <RES.xlsx> <BAL.xlsx> <Pieces.xlsx> [nom]');
  process.exit(1);
}
const module = { exports: {} };
vm.runInNewContext(readFileSync(resolve(root, 'src/vendor/xlsx.js'), 'utf8'),
  { module, exports: module.exports, Buffer, Uint8Array, ArrayBuffer, console, setTimeout, clearTimeout });
const XLSX = module.exports;
const book = (path) => ({
  name: basename(path),
  wb: XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true, cellStyles: true }),
});
const candidate = prepareImportCandidate(
  { resBook: book(resPath), balBook: book(balPath), piecesBook: book(piecesPath) }, null,
  { parseRES: (wb) => parseRES(XLSX, wb), parseBAL: (wb) => parseBAL(XLSX, wb), parsePieces: (wb) => parsePieces(XLSX, wb) });
const out = resolve(root, 'test/private', `${name}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(candidate, null, 2));
console.log(`${out} · années : ${Object.keys(candidate.years).join(', ')}`);
