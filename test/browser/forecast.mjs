import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createForecastFixtureFiles } from '../fixtures/generate.mjs';

const directory = mkdtempSync(resolve(tmpdir(), 'louty-forecast-'));
const fixtures = createForecastFixtureFiles(directory);
const server = createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (!['/', '/index.html', '/version.txt', '/favicon.svg'].includes(path)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', path.endsWith('.txt') ? 'text/plain' : path.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
  res.end(readFileSync(resolve(path === '/' ? 'index.html' : path.slice(1))));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const base = process.env.FORECAST_BASE_URL || `http://127.0.0.1:${server.address().port}/`;
  await page.goto(base);
  await page.locator('#file-input').setInputFiles([fixtures.res, fixtures.forecast]);
  await page.locator('[data-f-action="manage"]').waitFor();
  // Exercise color transitions as well as the initial numeric animation.
  await page.evaluate(() => {
    const chart = Chart.getChart(document.querySelector('#chart-ca-mb'));
    chart.setActiveElements([{ datasetIndex: 0, index: 0 }]);
    chart.update();
  });
  await page.locator('#chart-ca-mb').hover();
  await page.waitForTimeout(1100);
  const shot = async name => {
    if (!process.env.SMOKE_SCREENSHOT_DIR) return;
    mkdirSync(process.env.SMOKE_SCREENSHOT_DIR, { recursive:true });
    await page.waitForTimeout(1600);
    await page.screenshot({ path:resolve(process.env.SMOKE_SCREENSHOT_DIR, name + '.png') });
  };
  const row = number => page.locator('#forecast-list .forecast-row').filter({hasText:number});
  const partial = () => row('DEV-PARTIAL');
  const manual = () => row('DEV-MANUAL');
  const closeQuotes = async () => { if (await page.locator('#forecast-quotes').evaluate(e => e.open)) await page.locator('[data-f-action=close-quotes]').click(); };
  const openQuotes = async () => { if (!(await page.locator('#forecast-quotes').evaluate(e => e.open))) await page.locator('[data-f-action=quotes]').click(); };
  const filter = kind => page.locator(`.forecast-quick-filters [data-f-filter="${kind}"]`);
  // Administrative buckets are computed from the imported states, without saving choices.
  assert.equal(await filter('waiting').textContent(),'En attente client 1');
  assert.equal(await filter('validation').textContent(),'En attente de validation 2');
  assert.equal(await page.locator('#forecast-month').count(),0);
  assert.equal(await page.locator('.forecast-schedule').count(),0);
  await page.locator('[data-f-action="manage"]').click();
  assert.equal(await page.locator('#forecast-list .forecast-row').count(),4);
  assert.equal(await page.locator('#forecast-list .forecast-row').count(),4);
  assert.equal(await page.locator('#forecast-list img').count(),0,'imported text is escaped');
  assert.match(await partial().innerText(),/par nom client/);
  assert.match(await partial().innerText(),/En attente de validation/);
  await partial().getByRole('button',{name:'Modifier',exact:true}).click();
  assert.equal(await page.locator('#forecast-amount').inputValue(),'4100');
  assert.equal(await page.locator('#forecast-situation').inputValue(),'validation');
  await page.locator('#forecast-situation').selectOption('waiting');
  await page.locator('#forecast-form button[type=submit]').click();
  await manual().getByRole('button',{name:'Ajouter',exact:true}).click();
  await page.locator('#forecast-amount').fill('600');
  await page.locator('#forecast-situation').selectOption('confirmed');
  await page.locator('#forecast-form button[type=submit]').click();
  await page.locator('[data-f-action=close-manager]').click();
  assert.match(await page.locator('#cap-forecast').innerText(),/600/);
  assert.equal(await page.locator('#annual-cap #cap-forecast').count(),0);
  for (const [kind,expected] of [['confirmed',1],['waiting',2],['validation',1]]) {
    await openQuotes();
    await filter(kind).click();
    assert.equal(await page.locator('#forecast-dashboard-tables tbody tr').count(),expected);
    assert.equal(await page.locator('#forecast-manager').evaluate(e=>e.open),false);
    assert.equal(await filter(kind).getAttribute('aria-selected'),'true');
  }
  const link=filter('confirmed');
  await page.locator('#forecast-quotes-title').hover();const color=await link.evaluate(e=>getComputedStyle(e).color);
  await link.hover();assert.notEqual(await link.evaluate(e=>getComputedStyle(e).color),color);
  await closeQuotes();
  await page.locator('.forecast-help').focus();assert.equal(await page.locator('#help-tip').isVisible(),true);
  const chartForecast=await page.evaluate(()=>{
    const ds=Chart.getChart(document.querySelector('#chart-ca-mb')).data.datasets;
    const margin=ds.find(d=>d.label==='Marge estimée sur le CA à facturer (estimation) HT').data;
    const costs=ds.find(d=>d.label==='Achats & coûts estimés sur le CA à facturer (estimation) HT').data;
    if(ds.some(d=>d.label==='CA à facturer (estimation) HT (sélection)'))throw Error('Revenue counted twice');
    return {ca:margin.map((v,i)=>v===null?null:v+costs[i]),margin,costs};
  });
  assert.deepEqual(chartForecast.ca,[...Array(7).fill(null),120,120,120,120,120]);
  assert.deepEqual(chartForecast.margin.slice(7),[72,72,72,72,72]);
  assert.deepEqual(chartForecast.costs.slice(7),[48,48,48,48,48]);
  const cardValue=async title=>Number((await page.locator('.cap-projection').filter({hasText:title}).locator('.cap-projection-value').innerText()).replace(/[^0-9−-]/g,'').replace('−','-'));
  const projectedSeries=()=>page.evaluate(()=>Chart.getChart(document.querySelector('#chart-cumul')).data.datasets.find(d=>d.label.includes('Réalisé +'))?.data);
  assert.ok((await projectedSeries())[11]!==null,'uniform scenario reaches December');
  await page.locator('[data-pilotage-metric=ca]').click();const ca=await projectedSeries();
  assert.equal(ca[11]-ca[6],600);
  assert.equal(await cardValue('Projection chiffre'),Math.round(ca[11]));
  assert.deepEqual(ca.slice(7).map((v,i)=>v-ca[6]),[120,240,360,480,600]);
  assert.equal(JSON.parse(await page.locator('#chart-annual-progress').getAttribute('data-rows'))[0].projected,ca[11]);
  await page.locator('[data-pilotage-metric=mb]').click();
  assert.equal(await cardValue('Projection marge'),Math.round((await projectedSeries())[11]));
  await page.locator('.forecast-outlook summary').click();
  assert.match(await page.locator('.forecast-outlook').innerText(),/réparti uniformément/);
  assert.match(await page.locator('.forecast-outlook').innerText(),/Le taux historique s’applique uniquement/);
  await openQuotes();await filter('confirmed').click();
  assert.equal(await page.locator('.forecast-dashboard-tables table').count(),1);
  assert.equal(await page.locator('.forecast-dashboard-tables th').filter({hasText:'Mois'}).count(),0);
  await page.getByLabel('Rechercher dans les devis de cet onglet').fill('DEV-PARTIAL');
  assert.match(await page.locator('section[aria-label="Devis à facturer (estimation)"]').innerText(),/Aucun devis/);
  await filter('waiting').click();
  await page.getByLabel('Rechercher dans les devis de cet onglet').fill('DEV-PARTIAL');
  assert.match(await page.locator('section[aria-label="Devis en attente client"]').innerText(),/DEV-PARTIAL/);
  await page.getByLabel('Rechercher dans les devis de cet onglet').fill('');
  await closeQuotes();
  // Inspect card, tables, editor and all affected graphs at both sizes/themes.
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1100});
    for(const theme of ['light','dark']) {
      await page.evaluate(value=>{for(let i=0;i<2&&document.documentElement.getAttribute('data-theme')!==value;i++)document.querySelector('#toggle-theme').click();},theme);
      for(const [selector,name] of [['#cap-projections','projections'],['#revenue-forecast','forecast'],['#chart-ca-mb','monthly'],['#chart-annual-progress','annual'],['#chart-cumul','cumulative']]) {
        await page.locator(selector).scrollIntoViewIfNeeded();await shot(`${name}-${width}-${theme}`);
      }
      await openQuotes();await filter('confirmed').click();await page.locator('#forecast-dashboard-tables tr').filter({hasText:'DEV-MANUAL'}).locator('[data-f-edit]').click();
      await shot(`editor-${width}-${theme}`);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
  }
  await page.reload();await page.locator('[data-f-action=manage]').waitFor();
  assert.equal(await filter('waiting').textContent(),'En attente client 2');
  assert.equal(await page.locator('#forecast-quotes').evaluate(e=>e.open),false);
  await page.locator('#forecast-input').setInputFiles(fixtures.changed);
  await page.waitForFunction(()=>document.querySelector('#revenue-forecast').textContent.includes('1 devis sélectionné(s) à vérifier'));
  await page.locator('.forecast-warning [data-f-jump=review]').click();
  await page.locator('#forecast-dashboard-tables tr').filter({hasText:'DEV-PARTIAL'}).locator('[data-f-edit]').click();
  assert.equal(await page.locator('#forecast-amount').inputValue(),'4100','reimport preserves manual amount');
  await page.locator('#forecast-amount').fill('3700');await page.locator('#forecast-form button[type=submit]').click();
  await page.locator('#file-input').setInputFiles(fixtures.res);await page.locator('[data-f-action=import]').waitFor();
  assert.match(await page.locator('#revenue-forecast').innerText(),/choix sont conservés/);
  assert.equal(await page.locator('.cap-projection').filter({hasText:'Projection chiffre'}).locator('.cap-projection-value').innerText(),'—');
  await page.locator('#forecast-input').setInputFiles(fixtures.changed);await page.locator('[data-f-action=manage]').waitFor();
  assert.equal(await filter('waiting').textContent(),'En attente client 2');
  await openQuotes();await filter('confirmed').click();await page.locator('#forecast-dashboard-tables tr').filter({hasText:'DEV-MANUAL'}).locator('[data-f-edit]').click();
  await page.getByRole('button',{name:'Retirer du prévisionnel',exact:true}).click();await page.keyboard.press('Escape');
  assert.equal(await projectedSeries(),undefined,'removing confirmed work clears its cumulative scenario');
  assert.equal(await cardValue('Projection chiffre'),Math.round(ca[6]),'removing future work updates annual card to actual');
  assert.equal(await page.locator('.forecast-outlook').count(),0);
  assert.equal(await filter('confirmed').textContent(),'À facturer (estimation) 0');
  assert.deepEqual(errors,[]);
  console.log('Prévisionnel : trois catégories, projection uniforme, choix manuels, réimports, cache, graphiques, thèmes et mobile validés.');
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
  rmSync(directory, { recursive:true, force:true });
}
