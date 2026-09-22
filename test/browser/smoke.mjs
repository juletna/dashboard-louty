import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createFixtureFiles } from '../fixtures/generate.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixtureDirectory = mkdtempSync(resolve(tmpdir(), 'louty-browser-fixtures-'));
const fixtures = createFixtureFiles(fixtureDirectory);
const screenshotDirectory = process.env.SMOKE_SCREENSHOT_DIR;
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const trace = (step) => { if (process.env.SMOKE_TRACE === '1') process.stdout.write(`${step}\n`); };

function serve() {
  const server = createServer((request, response) => {
    const requested = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = requested === '/' ? 'index.html' : requested.slice(1);
    const path = resolve(root, relative);
    let isFile = false;
    try { isFile = path.startsWith(`${root}${sep}`) && statSync(path).isFile(); } catch { /* 404 */ }
    if (!isFile) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': mimeTypes[extname(path)] || 'application/octet-stream' });
    response.end(readFileSync(path));
  });
  return new Promise((resolveServer) => server.listen(0, '127.0.0.1', () => resolveServer(server)));
}

async function waitForDashboard(page, minimumCharts = 1) {
  await page.locator('#dashboard-root').waitFor({ state: 'visible' });
  await page.waitForFunction((neededCharts) => {
    const canvases = [...document.querySelectorAll('canvas')];
    return canvases.filter((canvas) => canvas.width > 0 && canvas.height > 0).length >= neededCharts;
  }, minimumCharts);
}

async function dashboardState(page) {
  return page.evaluate(() => {
    const chartCanvases = [...document.querySelectorAll('canvas')]
      .filter((canvas) => canvas.width > 0 && canvas.height > 0);
    const chartInstances = chartCanvases
      .map((canvas) => window.Chart?.getChart(canvas))
      .filter(Boolean);
    const echartHosts = [...document.querySelectorAll('[_echarts_instance_]')];
    const echartInstances = echartHosts
      .map((host) => window.LoutyECharts?.getInstanceByDom(host))
      .filter(Boolean);
    return {
      welcomeVisible: getComputedStyle(document.querySelector('#welcome')).display !== 'none',
      chartCanvases: chartCanvases.length,
      chartInstances: chartInstances.length,
      echartInstances: echartInstances.length,
      activeMetric: [...document.querySelectorAll('[data-pilotage-metric]')]
        .filter((button) => button.getAttribute('aria-pressed') === 'true')
        .map((button) => button.dataset.pilotageMetric),
      theme: document.documentElement.getAttribute('data-theme'),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      chartAnimations: chartInstances.map((chart) => chart.options.animation),
      echartAnimations: echartInstances.map((chart) => chart.getOption().animation),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    };
  });
}

const server = await serve();
const { port } = server.address();
let browser;

try {
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('body').innerText(), /Glisse tes exports Louty ici/);
  await page.locator('#file-input').setInputFiles([fixtures.res, fixtures.bal, fixtures.pieces]);
  await waitForDashboard(page, 6);
  trace('initial import');

  let state = await dashboardState(page);
  assert.equal(state.welcomeVisible, false, 'un import RES/BAL/Pièces doit afficher le tableau');
  assert.equal(state.chartCanvases, state.chartInstances, 'chaque canvas doit avoir une instance Chart.js');
  assert.ok(state.chartCanvases >= 6, `les graphiques principaux et les répartitions doivent être rendus (reçu : ${state.chartCanvases})`);
  assert.ok(state.echartInstances >= 2, `les jauges ECharts doivent être rendues (reçu : ${state.echartInstances})`);
  assert.deepEqual(state.activeMetric, ['mb']);
  assert.equal(state.reducedMotion, true);
  if (process.env.SMOKE_DIAGNOSTIC !== '1') {
    assert.ok(state.chartAnimations.every((animation) => animation === false), 'Chart.js doit désactiver les animations avec reduced-motion');
    assert.ok(state.echartAnimations.flat().every((animation) => animation === false), 'ECharts doit désactiver les animations avec reduced-motion');
  }

  await page.locator('#toggle-theme').click();
  assert.equal((await dashboardState(page)).theme, 'dark');
  await page.locator('#toggle-theme').click();
  assert.equal((await dashboardState(page)).theme, 'light');

  await page.locator('[data-pilotage-metric="ca"]').click();
  assert.deepEqual((await dashboardState(page)).activeMetric, ['ca']);
  await page.locator('[data-pilotage-metric="mb"]').click();
  assert.deepEqual((await dashboardState(page)).activeMetric, ['mb']);

  await page.locator('#open-settings').click();
  assert.equal(await page.locator('#settings-panel').evaluate((panel) => panel.classList.contains('open')), true);
  await page.locator('#settings-close').click();
  assert.equal(await page.locator('#settings-panel').evaluate((panel) => panel.classList.contains('open')), false);

  await page.locator('#cap-edit').click();
  assert.equal(await page.locator('#cap-drawer').getAttribute('aria-hidden'), 'false');
  await page.locator('#cap-drawer-close').click();
  assert.equal(await page.locator('#cap-drawer').getAttribute('aria-hidden'), 'true');

  const beforeReload = await dashboardState(page);
  await page.reload({ waitUntil: 'networkidle' });
  await waitForDashboard(page, 6);
  trace('first reload');
  const afterReload = await dashboardState(page);
  assert.equal(afterReload.chartCanvases, beforeReload.chartCanvases, 'les données mémorisées doivent restaurer les graphiques');
  assert.equal(afterReload.chartInstances, afterReload.chartCanvases, 'le reload ne doit pas dupliquer les instances Chart.js');

  await page.locator('#change-file').click();
  await page.locator('#welcome').waitFor({ state: 'visible' });
  await page.locator('#file-input').setInputFiles([fixtures.res, fixtures.bal, fixtures.invalid]);
  await page.waitForTimeout(250);
  trace(`invalid import: ${await page.locator('#welcome-err').evaluate((node) => `${getComputedStyle(node).display}|${node.textContent}`)}`);
  await page.locator('#welcome-err').waitFor({ state: 'visible' });
  await page.locator('#welcome-back').click();
  await waitForDashboard(page, 6);
  trace('invalid rollback');
  const afterRollback = await dashboardState(page);
  assert.equal(afterRollback.chartCanvases, beforeReload.chartCanvases, 'des Pièces invalides après une BAL valide ne doivent pas effacer le dernier tableau valide');

  await page.locator('#change-file').click();
  await page.locator('#welcome').waitFor({ state: 'visible' });
  await page.locator('#file-input').setInputFiles([fixtures.res, fixtures.bal, fixtures.pieces]);
  await waitForDashboard(page, 6);
  trace('valid reimport');
  assert.ok((await dashboardState(page)).echartInstances >= 2, 'le dépôt BAL/Pièces valide doit redessiner les jauges');
  await page.reload({ waitUntil: 'networkidle' });
  await waitForDashboard(page, 6);
  trace('second reload');

  await page.locator('#change-file').click();
  await page.locator('#welcome').waitFor({ state: 'visible' });
  await page.locator('#file-input').setInputFiles(fixtures.res);
  await waitForDashboard(page);
  trace('res only import');
  const resOnly = await dashboardState(page);
  assert.equal(resOnly.chartCanvases, resOnly.chartInstances, 'un RES sans Pièces doit détruire les instances Chart.js devenues orphelines');
  assert.equal(await page.locator('#chart-margin-by-quote').count(), 0, 'le graphique par devis doit disparaître sans Pièces');
  assert.equal(await page.locator('#chart-margin-by-client').count(), 0, 'le graphique par client doit disparaître sans Pièces');

  await page.locator('#change-file').click();
  await page.locator('#welcome').waitFor({ state: 'visible' });
  await page.locator('#file-input').setInputFiles([fixtures.res, fixtures.bal, fixtures.pieces]);
  await waitForDashboard(page, 6);
  trace('final full import');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  state = await dashboardState(page);
  const overwide = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter((element) => element.scrollWidth > innerWidth)
    .slice(0, 24)
    .map((element) => `${element.tagName.toLowerCase()}#${element.id}.${element.className}:${element.scrollWidth}`));
  const layout = await page.locator('.row1').evaluate((element) => {
    const card = document.querySelector('.annual-progress-card');
    const heading = card?.querySelector('h2');
    return `${matchMedia('(max-width: 900px)').matches}|${getComputedStyle(element).gridTemplateColumns}|${element.clientWidth}|${getComputedStyle(card).minWidth}/${card.clientWidth}/${card.scrollWidth}|${getComputedStyle(heading).whiteSpace}/${heading.clientWidth}/${heading.scrollWidth}`;
  });
  assert.ok(state.scrollWidth <= state.viewportWidth + 2, `le tableau mobile ne doit pas défiler horizontalement (${state.scrollWidth}px > ${state.viewportWidth}px; ${layout}; ${overwide.join(', ')})`);
  assert.deepEqual(pageErrors, [], `erreurs de page : ${pageErrors.join(' | ')}`);

  if (screenshotDirectory) {
    mkdirSync(screenshotDirectory, { recursive: true });
    await page.screenshot({ path: resolve(screenshotDirectory, 'mobile-light.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#toggle-theme').click();
    await page.screenshot({ path: resolve(screenshotDirectory, 'desktop-dark.png'), fullPage: true });
  }

  await context.close();
  process.stdout.write('Browser smoke test passed.\n');
} finally {
  await browser?.close();
  await new Promise((resolveServer) => server.close(resolveServer));
  rmSync(fixtureDirectory, { recursive: true, force: true });
}
