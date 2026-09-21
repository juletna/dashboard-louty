// Rebuild only the ECharts gauge/tooltip/SVG modules inside the offline HTML.
// Usage: node scripts/build-echarts-gauges.mjs
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const work = mkdtempSync(join(tmpdir(), 'louty-echarts-'));
try {
  execFileSync('npm', ['install', '--prefix', work, '--no-audit', '--no-fund', 'echarts@6.1.0', 'esbuild@0.25.12'], { stdio:'inherit' });
  writeFileSync(join(work, 'entry.js'), `import { init, use } from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
use([GaugeChart, TooltipComponent, SVGRenderer]);
export { init };
`);
  execFileSync(join(work, 'node_modules/.bin/esbuild'), [join(work, 'entry.js'), '--bundle', '--minify', '--format=iife', '--global-name=LoutyECharts', '--legal-comments=inline', '--outfile=' + join(work, 'gauges.min.js')], { stdio:'inherit' });
  const bundle = readFileSync(join(work, 'gauges.min.js'), 'utf8');
  if (/<\/script/i.test(bundle)) throw new Error('Unsafe inline script delimiter');
  const licenses = ['echarts/LICENSE', 'echarts/NOTICE', 'zrender/LICENSE'].map(name => readFileSync(join(work, 'node_modules', name), 'utf8')).join('\n');
  const file = new URL('../index.html', import.meta.url);
  const html = readFileSync(file, 'utf8');
  const start = html.indexOf('<script>/* Apache ECharts 6.1.0');
  const end = html.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('Missing ECharts bundle marker');
  const inline = '<script>/* Apache ECharts 6.1.0 — GaugeChart, TooltipComponent, SVGRenderer; offline bundle.\n' + licenses.replaceAll('*/', '* /') + '\n*/\n' + bundle + '\n</script>';
  writeFileSync(file, html.slice(0, start) + inline + html.slice(end + 9));
} finally {
  rmSync(work, { recursive:true, force:true });
}
