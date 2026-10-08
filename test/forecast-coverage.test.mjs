import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastCoverage, forecastSummary } from '../src/app/domain/forecast.js';

test('future coverage uses only the need remaining after actual revenue', () => {
  assert.deepEqual(forecastCoverage({actual:73247,annualConfirmed:17100},105430), {need:32183,confirmed:17100,balance:15083,percent:17100/32183*100});
  assert.equal(forecastCoverage({actual:null,annualConfirmed:100},1000),null);
  assert.equal(forecastCoverage({actual:0,annualConfirmed:100},null),null);
  assert.deepEqual(forecastCoverage({actual:0,annualConfirmed:0},100),{need:100,confirmed:0,balance:100,percent:0});
  assert.deepEqual(forecastCoverage({actual:120,annualConfirmed:30},100),{need:0,confirmed:30,balance:-30,percent:100});
  assert.deepEqual(forecastCoverage({actual:80,annualConfirmed:30},100),{need:20,confirmed:30,balance:-10,percent:100});
  assert.deepEqual(forecastCoverage({actual:-10,annualConfirmed:0},100),{need:110,confirmed:0,balance:110,percent:0});
  assert.equal(forecastCoverage({actual:0.1,annualConfirmed:0.1},0.3).balance,0.1);
});


test('undated confirmed jobs fill the gauge but never the annual scenario or the monthly calendar', () => {
  const data = { snapshot: { current: { year: '2026' } }, years: { 2026: {
    months_present: [1,2], monthly: { ca: [100,200,...Array(10).fill(null)] }
  } } };
  const row = (remaining, month = null, extra = {}) => ({ choice: { action: 'include', situation: 'confirmed', remaining, month }, ...extra });
  const rows = [row(100), row(200), row(50, '2026-10'), row(400,'2027-01'), row(500,'2026-02'),
    row(600,null,{review:true}), row(700,null,{missing:true}), {choice:{action:'include',situation:'waiting',remaining:800,month:null}}];
  const summary = forecastSummary(rows,data,1000);
  assert.equal(summary.undated,300); assert.equal(summary.annualConfirmed,50);
  assert.equal(summary.actualPlusConfirmed,350); assert.equal(summary.waiting,800);
  const coverage = forecastCoverage(summary,1000);
  assert.deepEqual(coverage,{need:700,confirmed:350,balance:350,percent:50});
  assert.deepEqual(summary.monthly,[null,null,null,null,null,null,null,null,null,50,null,null]);
  // Giving a job an admissible month moves its contribution from undated to
  // dated without counting it twice in the gauge.
  rows[0].choice.month='2026-11';
  const scheduled = forecastSummary(rows,data,1000);
  assert.equal(forecastCoverage(scheduled,1000).confirmed,350);
  assert.equal(scheduled.annualConfirmed,150); assert.equal(scheduled.actualPlusConfirmed,450);
  assert.deepEqual(forecastCoverage({actual:0,annualConfirmed:0,undated:120},100),{need:100,confirmed:120,balance:-20,percent:100});
});
