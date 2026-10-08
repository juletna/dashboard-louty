import test from 'node:test';
import assert from 'node:assert/strict';
import { quickForecastChoice } from '../src/app/domain/forecast-actions.js';
import { reconcileForecast, forecastSummary, forecastStatus, prepareDocuments } from '../src/app/domain/forecast.js';
import { createForecastStorage, validateChoice } from '../src/app/state/forecast.js';
const docs=prepareDocuments([{type:'Devis',number:'Q-A',activity:'FICTION',client:'Client fictif',client_id:'A',title:'Travaux',date:'2026-01-01',agreement_date:'2026-01-02',amount:100,amount_ttc:120,state:'Validé & imp.'}]);
const data={snapshot:{current:{year:'2026'}},years:{2026:{months_present:[1],monthly:{ca:[20,...Array(11).fill(null)]}}}};
test('manual review stays out of totals after persistence and reimport; reclassification preserves attachments and amount',()=>{
  const row=reconcileForecast(docs,new Map())[0];
  row.choice={...row.choice,advanceKeys:['A-1'],remaining:77.25};
  const choice=quickForecastChoice(row,'review');
  assert.equal(choice.reviewRequested,true);assert.equal(validateChoice(choice),true);
  assert.equal(row.choice.reviewRequested,undefined,'does not mutate current choice');
  let raw=null;const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v;}};
  createForecastStorage(storage).set(row.key,choice);
  const held=reconcileForecast(docs,createForecastStorage(storage).choices)[0];
  assert.equal(forecastStatus(held),'À vérifier');
  const summary=forecastSummary([held],data,1000);
  assert.equal(summary.confirmed,0);assert.equal(summary.waiting,0);assert.equal(summary.validation,0);
  assert.equal(summary.annualConfirmed,0);assert.equal(summary.reviewCount,0,'manual review is not a changed-reconciliation warning');
  for(const kind of ['waiting','validation','confirmed']){
    const next=quickForecastChoice(held,kind);
    assert.equal(next.situation,kind);assert.equal(next.reviewRequested,false);
    assert.equal(next.remaining,77.25);assert.deepEqual(next.advanceKeys,['A-1']);
    const nextRow=reconcileForecast(docs,new Map([[held.key,next]]))[0];
    assert.equal(forecastSummary([nextRow],data,1000)[kind==='confirmed'?'confirmed':kind],77.25);
  }
});
test('quick transitions cannot bypass missing or stale evidence, or turn a quote total into a remainder',()=>{
  const row=reconcileForecast(docs,new Map())[0];
  for(const patch of [{review:true},{missing:true},{choice:undefined},{choice:{...row.choice,remaining:null}}])
    assert.equal(quickForecastChoice({...row,...patch},'confirmed'),null);
  const stale={...row,review:true,choice:{...row.choice,fingerprint:'old'}};
  assert.equal(quickForecastChoice(stale,'review').fingerprint,'old');
  const removed=quickForecastChoice({...row,missing:true},'exclude');
  assert.equal(removed.action,'exclude');
  assert.equal(reconcileForecast(docs,new Map([[row.key,removed]]))[0].auto,false);
  assert.equal(validateChoice({...row.choice,reviewRequested:'yes'}),false);
  assert.equal(validateChoice(row.choice),true,'existing v1 caches remain valid');
});
