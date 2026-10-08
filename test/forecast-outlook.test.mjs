import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastSummary } from '../src/app/domain/forecast.js';
import { forecastOutlook } from '../src/app/domain/forecast-outlook.js';
import { HISTORICAL_METRICS } from '../src/app/domain/schema.js';
function data(actualMB = 40) {
  const year = (ca, mb, months) => ({months_present:Array.from({length:months},(_,i)=>i+1),monthly:Object.fromEntries(HISTORICAL_METRICS.map(key=>[key,[key==='ca'?ca:key==='marge_brute'?mb:0,...Array(11).fill(null)]]))});
  return { years:{2024:year(100,60,12),2025:year(300,210,12),2026:year(100,actualMB,9)},forecast:{year:'2026',cutoff:'2026-09',actual:100,monthly:[...Array(9).fill(null),20,null,30]} };
}
test('annual weighted margin consumes costs already incurred, distributes only future costs',()=>{
  const result=forecastOutlook(data());
  assert.equal(result.rate,.675); // Weighted 270 / 400, not average of 60% and 70%.
  assert.equal(result.actualCosts,60);
  assert.equal(result.futureCosts,0); // Stock advances already exceed 48.75 annual envelope.
  assert.equal(result.totalMB,90); // No invented refund to reach historical margin.
  assert.deepEqual(result.mb,[null,null,null,null,null,null,null,null,40,60,60,90]);
  assert.equal(result.totalCA,150);
});
test('ordinary remaining costs and negative catch-up margin remain visible',()=>{
  const result=forecastOutlook(data(80));
  assert.ok(Math.abs(result.futureCosts-28.75)<1e-10);
  assert.equal(result.totalMB,101.25);
  assert.equal(result.mb[9],88.5);
  const negative=forecastOutlook(data(150));
  assert.equal(negative.totalMB,101.25);
  assert.ok(negative.mb[9]<150);
});
test('missing historical or current margin leaves CA usable without invented margin',()=>{
  const input=data();delete input.years[2024];delete input.years[2025];
  assert.equal(forecastOutlook(input).totalMB,null);
  assert.equal(forecastOutlook(input).totalCA,150);
  const missing=data();missing.years[2026].monthly.marge_brute.fill(null);
  assert.equal(forecastOutlook(missing).totalMB,null);
});
test('no projection without confirmed future revenue or covered actual, stop at last available forecast month',()=>{
  const input=data();input.forecast.monthly[11]=null;
  assert.equal(forecastOutlook(input).ca[10],null);
  input.forecast.monthly[9]=null;assert.equal(forecastOutlook(input),null);
  const gap=data();gap.years[2026].months_present.splice(2,1);assert.equal(forecastOutlook(gap),null);
  const absent=data();absent.forecast.actual=null;assert.equal(forecastOutlook(absent),null);
});

test('monthly estimated costs and margin reconcile to confirmed revenue and annual envelope',()=>{
  const result=forecastOutlook(data(80));
  assert.equal(result.monthlyCosts[9],11.5);
  assert.equal(result.monthlyMargin[9],8.5);
  assert.equal(result.monthlyCosts[10],null);
  assert.equal(result.monthlyCosts.reduce((n,v)=>n+(v??0),0),28.75);
  assert.equal(result.monthlyMargin.reduce((n,v)=>n+(v??0),0),21.25);
  assert.equal(forecastOutlook(data()).monthlyCosts[9],0);
  assert.ok(forecastOutlook(data(150)).monthlyMargin[9]<0);
});

test('uniform confirmed scenario reaches December even with rounded zero months and reconciles all curves',()=>{
  const input=data(80);
  input.snapshot={current:{year:'2026'}};
  const rows=[{choice:{action:'include',situation:'confirmed',remaining:.01}}];
  input.forecast=forecastSummary(rows,input,1000);
  assert.deepEqual(input.forecast.monthly.slice(9),[0,.01,0]);
  let result=forecastOutlook(input);
  assert.equal(result.last,11);assert.equal(result.ca[11],100.01);assert.equal(result.totalCA,100.01);
  assert.equal(result.mb[11],result.totalMB);
  rows[0].choice.remaining=100;
  input.forecast=forecastSummary(rows,input,1000);result=forecastOutlook(input);
  assert.equal(result.totalCA,200);assert.equal(result.ca[11],200);
  for(let i=9;i<12;i++)assert.equal(Math.round((result.monthlyCosts[i]+result.monthlyMargin[i])*100),Math.round(input.forecast.monthly[i]*100));
});
