import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastSummary } from '../src/app/domain/forecast.js';
import { forecastOutlook, forecastProjection } from '../src/app/domain/forecast-outlook.js';
import { HISTORICAL_METRICS } from '../src/app/domain/schema.js';
function data(actualMB = 40) {
  const year = (ca, mb, months) => ({months_present:Array.from({length:months},(_,i)=>i+1),monthly:Object.fromEntries(HISTORICAL_METRICS.map(key=>[key,[key==='ca'?ca:key==='marge_brute'?mb:0,...Array(11).fill(null)]]))});
  return { revenue_distribution:{documents:[]}, years:{2024:year(100,60,12),2025:year(300,210,12),2026:year(100,actualMB,9)},forecast:{year:'2026',cutoff:'2026-09',actual:100,monthly:[...Array(9).fill(null),20,null,30]} };
}
test('projection adds order book revenue and applies weighted history only to future margin',()=>{
  const result=forecastOutlook(data());
  assert.equal(result.rate,.675); // 270 / 400, not average of 60% and 70%.
  assert.equal(result.futureCosts,16.25);
  assert.equal(result.totalMB,73.75); // 40 + 50 × 67.5%.
  assert.deepEqual(result.mb,[null,null,null,null,null,null,null,null,40,53.5,53.5,73.75]);
  assert.equal(result.totalCA,150);
  assert.equal(forecastOutlook(data(80)).totalMB,113.75);
  assert.equal(forecastOutlook(data(-80)).totalMB,-46.25);
});
test('reproduces reported CA discrepancy using quotes instead of statistical extrapolation',()=>{
  const input=data();input.forecast.actual=73247;
  input.forecast.monthly=[...Array(9).fill(null),10000,10000,15108];
  assert.equal(forecastProjection(input).totalCA,108355);
});
test('missing Pièces is unavailable, empty selection is zero future, closed year is actual only',()=>{
  const input=data();delete input.revenue_distribution;
  assert.equal(forecastProjection(input),null);
  input.revenue_distribution={documents:[]};input.forecast.monthly.fill(null);
  delete input.years[2024];delete input.years[2025];
  assert.equal(forecastProjection(input).totalCA,100);
  assert.equal(forecastProjection(input).totalMB,40);
  input.years[2026].months_present=[1,2,3,4,5,6,7,8,9,10,11,12];input.forecast.cutoff='2026-12';
  delete input.revenue_distribution;
  assert.equal(forecastProjection(input).totalCA,100);
  assert.equal(forecastProjection(input).rate,null,'current year cannot become its own historical reference');
});
test('rate uses last two complete prior CA/MB years, preserves zero and negative margins',()=>{
  const input=data();input.years[2023]=structuredClone(input.years[2024]);input.years[2023].monthly.marge_brute[0]=0;
  input.years[2025].months_present.pop(); // Incomplete year skipped.
  assert.deepEqual(forecastProjection(input).referenceYears,['2023','2024']);
  assert.equal(forecastProjection(input).rate,.3);
  input.years[2024].monthly.marge_brute[0]=0;
  assert.equal(forecastProjection(input).totalMB,40);
  input.years[2024].monthly.marge_brute[0]=-60;
  assert.equal(forecastProjection(input).totalMB,25);
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

test('monthly estimated costs and margin reconcile to future revenue and weighted historical margin',()=>{
  const result=forecastOutlook(data(80));
  assert.equal(result.monthlyCosts[9],6.5);
  assert.equal(result.monthlyMargin[9],13.5);
  assert.equal(result.monthlyCosts[10],null);
  assert.equal(result.monthlyCosts.reduce((n,v)=>n+(v??0),0),16.25);
  assert.equal(result.monthlyMargin.reduce((n,v)=>n+(v??0),0),33.75);
  assert.equal(forecastOutlook(data()).monthlyCosts[9],6.5);
  assert.equal(forecastOutlook(data(150)).monthlyMargin[9],13.5);
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

test('contribution rate uses the margin reference years and stays unavailable when a year lacks it',()=>{
  const input=data();
  input.years[2024].monthly.contribution_coop[0]=6;input.years[2025].monthly.contribution_coop[0]=21;
  assert.equal(forecastProjection(input).contributionRate,.1); // 27 / 270, same years as the margin rate.
  input.years[2025].monthly.contribution_coop=Array(12).fill(null);
  assert.equal(forecastProjection(input).contributionRate,null);
});
