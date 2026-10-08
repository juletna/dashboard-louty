import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDocuments, reconcileForecast, forecastStatus, forecastSummary } from '../src/app/domain/forecast.js';
import { createForecastStorage } from '../src/app/state/forecast.js';
const q=(number,state,extra={})=>({type:'Devis',number,state,amount:100,amount_ttc:120,client:'Client fictif '+number,client_id:number || 'X',activity:'ACT',date:'2026-01-01',agreement_date:null,...extra});
const run=(docs,choices=new Map())=>reconcileForecast(prepareDocuments(docs),choices);
const data={snapshot:{current:{year:'2026'}},years:{2026:{months_present:[1],monthly:{ca:[0,...Array(11).fill(null)]}}}};

test('numbered validated/printed quotes wait for client; validation quotes form a separate bucket, even without a number',()=>{
  const rows=run([q('SENT','  VALIDÉ & IMP. '),q('VALIDATE','Attente valid.'),q('','Attente valid.'),q('','Validé & imp.',{client_id:'Y'}),q('UNKNOWN','Autre état'),q('DRAFT','Brouillon')]);
  assert.equal(rows.length,5);
  assert.deepEqual(rows.slice(0,3).map(forecastStatus),['En attente client','En attente de validation','En attente de validation']);
  assert.ok(rows.slice(0,3).every(r=>r.auto&&!r.review));
  assert.ok(rows.slice(3).every(r=>!r.choice&&forecastStatus(r)==='À vérifier'));
  const s=forecastSummary(rows,data,1000);
  assert.equal(s.waiting,100);assert.equal(s.validation,200);assert.equal(s.confirmed,0);assert.equal(s.annualConfirmed,0);
});

test('agreement, full billing, and ambiguous evidence take priority over administrative waiting buckets',()=>{
  for(const state of ['Validé & imp.','Attente valid.']) {
    const accepted=q('Q',state,{agreement_date:'2026-01-02'});
    assert.equal(run([accepted])[0].choice.situation,'confirmed');
    const bill={...accepted,type:'Facture',state:'Confirmé',number:'F',date:'2026-02-01',agreement_date:null};
    assert.equal(forecastStatus(run([accepted,bill])[0]),'Entièrement facturé');
    const reduced={...bill,amount:90,amount_ttc:108};
    assert.equal(forecastStatus(run([q('Q',state),reduced])[0]),'À vérifier');
    assert.equal(forecastSummary(run([q('Q',state),reduced]),data,1000).waiting,0);
  }
});

test('manual bucket/exclusion survives reload; old months are ignored without overwriting cache and changed states require review',()=>{
  const original=q('Q','Attente valid.');const [r]=run([original]);let raw=null;
  const storage={getItem:()=>raw,setItem:(_,v)=>raw=v};const cache=createForecastStorage(storage);
  const choice={action:'include',situation:'waiting',remaining:75,month:'2027-01',fingerprint:r.fingerprint,quote:r};
  cache.set(r.key,choice);const before=raw;
  const [manual]=run([original],createForecastStorage(storage).choices);
  assert.equal(manual.auto,false);assert.equal(manual.choice.month,null);assert.equal(manual.choice.remaining,75);assert.equal(manual.review,false);assert.equal(raw,before);
  assert.equal(forecastSummary([manual],data,1000).waiting,75);
  assert.equal(run([{...original,state:'Validé & imp.'}],cache.choices)[0].review,true);
  cache.set(r.key,{...choice,situation:'validation',month:undefined});
  assert.equal(run([original],createForecastStorage(storage).choices)[0].choice.situation,'validation');
  cache.set(r.key,{action:'exclude',fingerprint:r.fingerprint,quote:r});
  assert.equal(run([original],cache.choices)[0].auto,false);assert.equal(forecastSummary(run([original],cache.choices),data,1000).validation,0);
});
