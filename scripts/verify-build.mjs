import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildArtifact } from './build.mjs';
import { assertNoExternalActiveResources } from './offline-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const { html, version } = buildArtifact();
if (read('index.html') !== html) throw new Error('index.html is stale; run npm run build');
if (read('version.txt') !== version) throw new Error('version.txt does not match APP_VERSION');

const template = read('src/template/index.html');
const ordered = [
  'src/app/early-theme.js', 'src/vendor/echarts.js', 'src/vendor/chart.js',
  'src/vendor/xlsx.js', 'src/app/parser.js', 'src/app/legacy.js',
];
const positions = ordered.map((path) => template.indexOf(`{{${path}}}`));
if (positions.some((pos) => pos < 0) || positions.some((pos, i) => i && pos <= positions[i - 1])) {
  throw new Error('Inline script order changed');
}
if (!template.includes('<style>{{src/styles/main.css}}</style>') ||
    !template.includes('<script>{{src/app/early-theme.js}}</script>\n</head>')) {
  throw new Error('Styles or early theme script moved from the head');
}
if (!html.includes("default-src 'none'") || !html.includes("script-src 'unsafe-inline'") ||
    !html.includes("connect-src 'self'")) {
  throw new Error('Offline Content Security Policy changed');
}
const appScripts = read('src/app/early-theme.js') + read('src/app/parser.js') + read('src/app/legacy.js');
assertNoExternalActiveResources(template, read('src/styles/main.css'), appScripts);
for (const [path, marker] of [
  ['src/vendor/echarts.js', 'Apache ECharts 6.1.0'],
  ['src/vendor/chart.js', 'Chart.js 4.5.0'],
  ['src/vendor/xlsx.js', 'SheetJS xlsx 0.20.3'],
]) {
  if (!read(path).startsWith(`/* ${marker}`)) throw new Error(`Vendor marker missing: ${path}`);
}
if (!read('src/vendor/echarts.js').includes('Apache License') ||
    !read('src/vendor/echarts.js').includes('zrender')) {
  throw new Error('ECharts licences missing');
}
for (const path of ordered.concat('src/vendor/echarts-entry.js')) {
  execFileSync(process.execPath, ['--check', resolve(root, path)], { stdio: 'pipe' });
}
process.stdout.write(`Verified standalone build ${version}\n`);
