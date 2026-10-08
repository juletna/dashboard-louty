import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { createBillingFixtureFiles } from '../fixtures/generate.mjs';
const directory=mkdtempSync(resolve(tmpdir(),'louty-billing-'));
const fixtures=createBillingFixtureFiles(directory);
const server=createServer((req,res)=>{
  const path=req.url.split('?')[0];
  if(!['/','/index.html','/version.txt','/favicon.svg'].includes(path)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',path.endsWith('.txt')?'text/plain':path.endsWith('.svg')?'image/svg+xml':'text/html');
  res.end(readFileSync(resolve(path==='/'?'index.html':path.slice(1))));
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try {
  browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  const openQuotes=async()=>{if(!(await page.locator('#forecast-quotes').evaluate(e=>e.open)))await page.locator('[data-f-action=quotes]').click();};
  const closeQuotes=async()=>{if(await page.locator('#forecast-quotes').evaluate(e=>e.open))await page.locator('[data-f-action=close-quotes]').click();};
  const openActions=async scope=>{const toggle=scope.locator('.forecast-actions-toggle');if(await toggle.isVisible() && await toggle.getAttribute('aria-expanded')==='false'){await toggle.click();assert.equal(await page.locator('#forecast-manager').evaluate(e=>e.open),false);}};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.FORECAST_BASE_URL || `http://127.0.0.1:${server.address().port}/`);
  await page.locator('#file-input').setInputFiles([fixtures.res,fixtures.billing]);
  await page.locator('[data-f-action=manage]').waitFor();
  const originalGaugeWidth=(await page.locator('#cap-forecast').boundingBox()).width;
  assert.equal(await page.locator('[data-f-filter=confirmed]').textContent(),'À facturer (estimation) 2');
  assert.equal(await page.locator('.forecast-quick-filters [data-f-filter=waiting]').textContent(),'En attente client 1');
  assert.equal(await page.locator('.forecast-quick-filters [data-f-filter=validation]').textContent(),'En attente de validation 2');
  assert.match(await page.locator('aside[aria-label="En attente client"]').innerText(),/70 €/);
  assert.match(await page.locator('aside[aria-label="En attente de validation"]').innerText(),/110 €/);
  assert.equal(await page.locator('#forecast-month').count(),0);
  assert.equal(await page.locator('.forecast-schedule').count(),0);
  assert.match(await page.locator('.forecast-estimated').innerText(),/205 €/);
  assert.equal(await page.locator('.forecast-column').count(),0);
  assert.ok(await page.locator('.forecast-coverage-track > span').evaluate(e=>parseFloat(e.style.width)>0));
  // Cards navigate locally; review amounts never join the annual estimate.
  await page.locator('[data-f-jump=review]').click();
  assert.equal(await page.locator('[data-f-filter=review]').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#forecast-dashboard-tables tbody tr').count(),1);
  assert.match(await page.locator('#forecast-dashboard-tables').innerText(),/Q-SCOPE/);
  assert.match(await page.locator('#forecast-dashboard-tables').innerText(),/reste à déterminer/);
  assert.match(await page.locator('.forecast-estimated').innerText(),/205 €/);
  await openActions(page);
  await page.locator('[data-f-target=confirmed]').click();
  assert.equal(await page.locator('#forecast-editor').evaluate(e=>e.open),true,'ambiguous amounts require examination');
  assert.equal(await page.locator('#forecast-situation').inputValue(),'confirmed');
  assert.equal(await page.locator('#forecast-amount').inputValue(),'30','candidate remainder, not the whole quote');
  await page.keyboard.press('Escape');
  assert.match(await page.locator('.forecast-estimated').innerText(),/205 €/,'opening the editor does not reactivate the quote');
  await page.waitForFunction(()=>!document.querySelector('#forecast-editor').open);
  await page.locator('[data-f-filter=review]').press('Home');
  assert.equal(await page.locator('[data-f-filter=confirmed]').getAttribute('aria-selected'),'true');
  await page.locator('#forecast-dashboard-search').fill('Q-DEPOSIT');
  assert.equal(await page.locator('#forecast-dashboard-tables tbody tr').count(),1);
  await page.locator('#forecast-dashboard-search').fill('');
  await closeQuotes();
  assert.equal(await page.evaluate(()=>document.activeElement?.matches('[data-f-action=quotes],[data-f-jump]')),true,'closing the quotes modal returns focus to an entry link');
  // Every entry point opens the same modal; Escape closes it and focus comes back to the button.
  await page.locator('[data-f-action=quotes]').click();
  assert.equal(await page.locator('#forecast-quotes').evaluate(e=>e.open),true);
  assert.equal(await page.locator('[data-f-filter=confirmed]').getAttribute('aria-selected'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'forecast-tab-confirmed');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#forecast-quotes').evaluate(e=>e.open),false);
  assert.equal(await page.evaluate(()=>document.activeElement?.matches('[data-f-action=quotes]')),true);
  await page.locator('[data-f-jump=waiting]').click();
  assert.equal(await page.locator('[data-f-filter=waiting]').getAttribute('aria-selected'),'true');
  await page.locator('[data-f-filter=confirmed]').click();
  await closeQuotes();
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1100});
    for(const theme of ['light','dark']) {
      await page.evaluate(value=>{for(let i=0;i<2&&document.documentElement.getAttribute('data-theme')!==value;i++)document.querySelector('#toggle-theme').click();},theme);
      await page.locator('#revenue-forecast').scrollIntoViewIfNeeded();
      if(process.env.SMOKE_SCREENSHOT_DIR){mkdirSync(process.env.SMOKE_SCREENSHOT_DIR,{recursive:true});await page.locator('#revenue-forecast').screenshot({path:resolve(process.env.SMOKE_SCREENSHOT_DIR,`undated-gauge-${width}-${theme}.png`)});}
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
  }
  await openQuotes();
  await page.locator('#forecast-dashboard-tables tr').filter({hasText:'Q-DEPOSIT'}).locator('[data-f-edit]').click();
  const originalAmount=await page.locator('#forecast-amount').inputValue();
  await page.locator('#forecast-amount').fill('100000');
  await page.locator('#forecast-form button[type=submit]').click();
  await closeQuotes();
  assert.equal(await page.locator('.forecast-excess').count(),1);
  const parts=await page.locator('.forecast-coverage-track > span').evaluateAll(es=>es.map(e=>parseFloat(e.style.width)));
  assert.ok(Math.abs(parts.reduce((a,b)=>a+b,0)-100)<0.001,'covered plus surplus fills the entire bar');
  assert.equal(await page.locator('.forecast-threshold').evaluate(e=>getComputedStyle(e,'::after').display),'block');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1100});
    for(const theme of ['light','dark']) {
      await page.evaluate(value=>{for(let i=0;i<2&&document.documentElement.getAttribute('data-theme')!==value;i++)document.querySelector('#toggle-theme').click();},theme);
      if(process.env.SMOKE_SCREENSHOT_DIR)await page.locator('#revenue-forecast').screenshot({path:resolve(process.env.SMOKE_SCREENSHOT_DIR,`excess-${width}-${theme}.png`)});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
  }
  await openQuotes();
  await page.locator('#forecast-dashboard-tables tr').filter({hasText:'Q-DEPOSIT'}).locator('[data-f-edit]').click();
  await page.locator('#forecast-amount').fill(originalAmount);
  await page.locator('#forecast-form button[type=submit]').click();
  assert.equal(await page.locator('.forecast-excess').count(),0);
  assert.equal(await page.locator('.forecast-threshold').evaluate(e=>getComputedStyle(e,'::after').display),'none');
  await closeQuotes();
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('[data-f-action=manage]').click();
  const row=n=>page.locator('#forecast-list .forecast-row').filter({hasText:n});
  for(const [n,status] of [['Q-DEPOSIT','À facturer (estimation)'],['Q-PROGRESS','À facturer (estimation) · Partiellement facturé'],['Q-SCOPE','À vérifier'],['Q-COVERED','Entièrement facturé'],['Q-WAIT','En attente client']]) assert.ok((await row(n).innerText()).includes(status));
  assert.match(await row('Q-SCOPE').innerText(),/À déterminer/);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:width===390?844:1100});
    for(const theme of ['light','dark']) {
      await page.evaluate(value=>{for(let i=0;i<2&&document.documentElement.getAttribute('data-theme')!==value;i++)document.querySelector('#toggle-theme').click();},theme);
      assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
      assert.equal(await row('Q-DEPOSIT').locator('strong').evaluate(e=>getComputedStyle(e).color),theme==='dark'?'rgb(234, 231, 240)':'rgb(34, 31, 43)');
      if(process.env.SMOKE_SCREENSHOT_DIR){mkdirSync(process.env.SMOKE_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.SMOKE_SCREENSHOT_DIR,`billing-manager-${width}-${theme}.png`)});}
      await row('Q-SCOPE').getByRole('button',{name:'Ajouter',exact:true}).click();
      assert.equal(await page.locator('#forecast-amount').inputValue(),'30');
      await page.locator('#forecast-evidence').locator('..').evaluate(e=>e.open=true);
      assert.match(await page.locator('#forecast-evidence').innerText(),/Reste candidat.*30,00.*hors totaux/);
      await page.locator('#forecast-evidence').scrollIntoViewIfNeeded();
      if(process.env.SMOKE_SCREENSHOT_DIR) await page.screenshot({path:resolve(process.env.SMOKE_SCREENSHOT_DIR,`billing-editor-${width}-${theme}.png`)});
      await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
  }
  await page.locator('[data-f-situation=review]').click();assert.equal(await page.locator('#forecast-list .forecast-row').count(),1);
  await row('Q-SCOPE').getByRole('button',{name:'Ajouter',exact:true}).click();
  await page.locator('#forecast-form button[type=submit]').click();
  assert.equal(await page.locator('#forecast-list .forecast-row').count(),0);
  await page.locator('[data-f-action=close-manager]').click();
  assert.match(await page.locator('.forecast-estimated').innerText(),/235 €/);
  assert.equal(await page.locator('.forecast-column').count(),0);
  await page.reload();await page.locator('[data-f-action=manage]').waitFor();
  assert.equal(await page.locator('[data-f-filter=confirmed]').textContent(),'À facturer (estimation) 3');
  // Promote a waiting quote in one click, with no editor and a durable manual decision.
  await page.locator('[data-f-jump=waiting]').click();
  assert.equal(await page.locator('[data-f-target=confirmed]').count(),1);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1100});
    for(const theme of ['light','dark']) {
      await page.evaluate(value=>{for(let i=0;i<2&&document.documentElement.getAttribute('data-theme')!==value;i++)document.querySelector('#toggle-theme').click();},theme);
      if(process.env.SMOKE_SCREENSHOT_DIR)await page.locator('#revenue-forecast').screenshot({path:resolve(process.env.SMOKE_SCREENSHOT_DIR,`quick-confirm-${width}-${theme}.png`)});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    }
  }
  await openActions(page);
  assert.equal(await page.locator('[data-f-transition]').count(),4);
  await page.locator('[data-f-target=confirmed]').click();
  assert.equal(await page.locator('#forecast-editor').evaluate(e=>e.open),false);
  assert.equal(await page.locator('[data-f-target=confirmed]').count(),0);
  assert.match(await page.locator('#forecast-quick-message').innerText(),/Q-WAIT.*À facturer/);
  assert.match(await page.locator('.forecast-estimated').innerText(),/305 €/);
  assert.equal(await page.locator('aside[aria-label="En attente client"].is-empty[aria-disabled="true"]').count(),1);
  await page.reload();await page.locator('[data-f-action=manage]').waitFor();
  assert.match(await page.locator('.forecast-estimated').innerText(),/305 €/);
  await page.locator('#forecast-input').setInputFiles(fixtures.billing);
  await page.locator('[data-f-action=manage]').waitFor();
  assert.match(await page.locator('.forecast-estimated').innerText(),/305 €/);
  await openQuotes();
  assert.match(await page.locator('#forecast-dashboard-tables').innerText(),/Q-WAIT/);
  // Every bucket exposes Exclude and the three other states. Manual review is durable.
  const tableRow=()=>page.locator('#forecast-dashboard-tables tr').filter({hasText:'Q-WAIT'});
  const transition=async (from,to)=>{
    await openQuotes();
    await page.locator(`[data-f-filter=${from}]`).click();
    await openActions(tableRow());
    assert.equal(await tableRow().locator('[data-f-transition]').count(),4);
    assert.equal(await tableRow().locator(`[data-f-target=${from}]`).count(),0);
    await tableRow().locator(`[data-f-target=${to}]`).click();
  };
  await transition('confirmed','review');
  assert.match(await page.locator('.forecast-estimated').innerText(),/235 €/);
  await page.reload();await page.locator('[data-f-action=manage]').waitFor();
  await page.locator('#forecast-input').setInputFiles(fixtures.billing);
  await page.locator('[data-f-jump=review]').click();
  assert.match(await tableRow().innerText(),/Mis à examiner manuellement/);
  if(process.env.SMOKE_SCREENSHOT_DIR){
    await openActions(tableRow());
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1100});
      for(const theme of ['light','dark']){
        await page.evaluate(value=>{for(let i=0;i<2&&document.documentElement.getAttribute('data-theme')!==value;i++)document.querySelector('#toggle-theme').click();},theme);
        await page.locator('[data-f-jump=review]').click();
        await openActions(tableRow());
        await page.locator('#revenue-forecast').screenshot({path:resolve(process.env.SMOKE_SCREENSHOT_DIR,`actions-${width}-${theme}.png`)});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
    }
  }
  await page.setViewportSize({width:390,height:844});
  await transition('review','validation');
  assert.equal(await page.locator('#forecast-editor').evaluate(e=>e.open),false);
  assert.match(await page.locator('aside[aria-label="En attente de validation"]').innerText(),/180 €/);
  await transition('validation','waiting');
  assert.match(await page.locator('aside[aria-label="En attente client"]').innerText(),/70 €/);
  await transition('waiting','exclude');
  await page.locator('#forecast-input').setInputFiles(fixtures.billing);
  await openQuotes();
  await page.locator('[data-f-filter=waiting]').click();
  assert.equal(await tableRow().count(),0);
  assert.equal(await page.locator('aside[aria-label="En attente client"].is-empty[aria-disabled="true"]').count(),1);
  await page.setViewportSize({width:1440,height:1100});
  for(const kind of ['validation','review']) {
    await page.locator(`[data-f-filter=${kind}]`).click();
    while(await page.locator('[data-f-target=waiting]').count())await page.locator('[data-f-target=waiting]').first().click();
  }
  assert.equal(await page.locator('.forecast-potential').count(),3,'empty cards stay visible');
  assert.equal(await page.locator('.forecast-potential-stack').count(),0);
  assert.equal(await page.locator('.forecast-potentials > .forecast-potential').count(),3,'three situation cards on one row');
  assert.ok(Math.abs((await page.locator('#cap-forecast').boundingBox()).width-originalGaugeWidth)<1,'gauge width does not depend on empty cards');
  const snapshotLayout=async name=>{
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1100});
      for(const theme of ['light','dark']){
        await page.evaluate(value=>{for(let i=0;i<2&&document.documentElement.getAttribute('data-theme')!==value;i++)document.querySelector('#toggle-theme').click();},theme);
        if(process.env.SMOKE_SCREENSHOT_DIR)await page.locator('#revenue-forecast').screenshot({path:resolve(process.env.SMOKE_SCREENSHOT_DIR,`${name}-${width}-${theme}.png`)});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
    }
  };
  await snapshotLayout('one-column');
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('[data-f-filter=waiting]').click();
  while(await page.locator('[data-f-target=exclude]').count())await page.locator('[data-f-target=exclude]').first().click();
  assert.equal(await page.locator('.forecast-potential').count(),3);
  assert.equal(await page.locator('.forecast-potential.is-empty[aria-disabled="true"]').count(),3,'all cards disabled when empty');
  assert.ok(Math.abs((await page.locator('#cap-forecast').boundingBox()).width-originalGaugeWidth)<1);
  await snapshotLayout('all-empty');
  assert.deepEqual(errors,[]);
  console.log('Facturation : statuts, reste candidat, totaux, acompte déduit du reste, situations impayées, attentes séparées et décision mémorisée validés.');
} finally {await browser?.close();await new Promise(done=>server.close(done));rmSync(directory,{recursive:true,force:true});}
