import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const slots = [
  'src/styles/main.css',
  'src/app/early-theme.js',
  'src/vendor/echarts.js',
  'src/vendor/chart.js',
  'src/vendor/xlsx.js',
  'src/app/bundle.js',
];

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function buildApplicationBundle() {
  const result = buildSync({
    entryPoints: [resolve(root, 'src/app/entry.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    legalComments: 'inline',
    write: false,
  });
  return result.outputFiles[0].text;
}

export function buildArtifact() {
  let html = read('src/template/index.html');
  for (const relativePath of slots) {
    const marker = `{{${relativePath}}}`;
    if (html.split(marker).length !== 2) {
      throw new Error(`Expected exactly one build marker: ${marker}`);
    }
    const source = relativePath === 'src/app/bundle.js' ? buildApplicationBundle() : read(relativePath);
    if (relativePath.endsWith('.js') && /<\/script/i.test(source)) {
      throw new Error(`Unsafe inline script delimiter: ${relativePath}`);
    }
    if (relativePath.endsWith('.css') && /<\/style/i.test(source)) {
      throw new Error(`Unsafe inline style delimiter: ${relativePath}`);
    }
    html = html.replace(marker, () => source);
  }
  if (/\{\{src\//.test(html)) throw new Error('Unresolved build marker');
  const versionMatches = [...read('src/app/legacy.js').matchAll(/\bvar APP_VERSION = "([0-9]{8}-[0-9]{6})";/g)];
  if (versionMatches.length !== 1) throw new Error('Expected exactly one APP_VERSION declaration');
  return { html, version: versionMatches[0][1] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { html, version } = buildArtifact();
  writeFileSync(resolve(root, 'index.html'), html);
  writeFileSync(resolve(root, 'version.txt'), version);
  process.stdout.write(`Built index.html (${Buffer.byteLength(html)} bytes), version ${version}\n`);
}
