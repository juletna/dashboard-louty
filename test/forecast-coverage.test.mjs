import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastCoverage, forecastSummary } from '../src/app/domain/forecast.js';

test('future coverage uses only the need remaining after actual revenue', () => {
  assert.deepEqual(forecastCoverage({actual:73247,confirmed:17100},105430), {need:32183,confirmed:17100,balance:15083,percent:17100/32183*100});
  assert.equal(forecastCoverage({actual:null,confirmed:100},1000),null);
  assert.equal(forecastCoverage({actual:0,confirmed:100},null),null);
  assert.deepEqual(forecastCoverage({actual:0,confirmed:0},100),{need:100,confirmed:0,balance:100,percent:0});
  assert.deepEqual(forecastCoverage({actual:120,confirmed:30},100),{need:0,confirmed:30,balance:-30,percent:100});
  assert.deepEqual(forecastCoverage({actual:80,confirmed:30},100),{need:20,confirmed:30,balance:-10,percent:100});
  assert.deepEqual(forecastCoverage({actual:-10,confirmed:0},100),{need:110,confirmed:0,balance:110,percent:0});
  assert.equal(forecastCoverage({actual:0.1,confirmed:0.1},0.3).balance,0.1);
});


test('all confirmed work fills the gauge and the uniform annual scenario; waits and stale choices are excluded', () => {
  const data = { snapshot: { current: { year: '2026' } }, years: { 2026: {
    months_present: [1,2], monthly: { ca: [100,200,...Array(10).fill(null)] }
  } } };
  const row = (remaining, month = null, extra = {}) => ({ choice: { action: 'include', situation: 'confirmed', remaining, month }, ...extra });
  const rows = [row(100), row(200), row(50, '2026-10'), row(400,'2027-01'), row(500,'2026-02'),
    row(600,null,{review:true}), row(700,null,{missing:true}), {choice:{action:'include',situation:'waiting',remaining:800}},
    {choice:{action:'include',situation:'validation',remaining:900}}];
  const summary = forecastSummary(rows,data,1000);
  assert.equal(summary.confirmed,1250); assert.equal(summary.annualConfirmed,1250);
  assert.equal(summary.actualPlusConfirmed,1550); assert.equal(summary.waiting,800); assert.equal(summary.validation,900);
  assert.deepEqual(forecastCoverage(summary,1000),{need:700,confirmed:1250,balance:-550,percent:100});
  assert.deepEqual(summary.monthly,[null,null,...Array(10).fill(125)]);
  rows[0].choice.month='2026-11';
  assert.deepEqual(forecastSummary(rows,data,1000),summary);
});

test('uniform distribution conserves cents, zero and negative actuals; complete or invalid RES never receives projections', () => {
  const row = {choice:{action:'include',situation:'confirmed',remaining:100}};
  const data = {snapshot:{current:{year:'2026'}},years:{2026:{months_present:[1,2,3,4,5,6,7,8,9],monthly:{ca:[-10,...Array(11).fill(null)]}}}};
  let s = forecastSummary([row],data,1000);
  assert.equal(s.actual,-10); assert.equal(s.actualPlusConfirmed,90);
  assert.deepEqual(s.monthly,[...Array(9).fill(null),33.33,33.34,33.33]);
  data.years[2026].months_present=Array.from({length:12},(_,i)=>i+1);
  s=forecastSummary([row],data,1000);
  assert.equal(s.confirmed,100); assert.equal(s.annualConfirmed,0); assert.equal(s.actualPlusConfirmed,-10); assert.ok(s.monthly.every(v=>v===null));
  for (const months of [[],[1,3]]) {
    data.years[2026].months_present=months;
    s=forecastSummary([row],data,1000);
    assert.equal(s.actual,null); assert.equal(s.actualPlusConfirmed,null); assert.ok(s.monthly.every(v=>v===null));
  }
  data.years[2026].months_present=[1,2];data.years[2026].monthly.ca=[0,...Array(11).fill(null)];
  s=forecastSummary([],data,1000);assert.equal(s.actual,0);assert.equal(s.confirmed,0);assert.ok(s.monthly.every(v=>v===null));
});
