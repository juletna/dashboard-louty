// Rebuild the pinned ECharts subset. The normal build reuses the checked-in bundle.
// Usage: npm run build:echarts
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = resolve(root, 'node_modules');
const result = await build({
  entryPoints: [resolve(root, 'src/vendor/echarts-entry.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'LoutyECharts',
  legalComments: 'inline',
  outfile: 'echarts.min.js',
  write: false,
});
const bundle = result.outputFiles[0].text;
if (/<\/script/i.test(bundle)) throw new Error('Unsafe inline script delimiter');
const licenses = ['echarts/LICENSE', 'echarts/NOTICE', 'zrender/LICENSE']
  .map((path) => readFileSync(resolve(nodeModules, path), 'utf8'))
  .join('\n');
const source = '/* Apache ECharts 6.1.0 — GaugeChart, BarChart, GridComponent, MarkLineComponent, TooltipComponent, SVGRenderer; offline bundle.\n' +
  licenses.replaceAll('*/', '* /') + '\n*/\n' + bundle + '\n';
writeFileSync(resolve(root, 'src/vendor/echarts.js'), source);
process.stdout.write('Rebuilt src/vendor/echarts.js\n');
