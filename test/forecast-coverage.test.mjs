import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastCoverage } from '../src/app/domain/forecast.js';

test('future coverage uses only the need remaining after actual revenue', () => {
  assert.deepEqual(forecastCoverage({actual:73247,annualConfirmed:17100},105430), {need:32183,balance:15083,percent:17100/32183*100});
  assert.equal(forecastCoverage({actual:null,annualConfirmed:100},1000),null);
  assert.equal(forecastCoverage({actual:0,annualConfirmed:100},null),null);
  assert.deepEqual(forecastCoverage({actual:0,annualConfirmed:0},100),{need:100,balance:100,percent:0});
  assert.deepEqual(forecastCoverage({actual:120,annualConfirmed:30},100),{need:0,balance:-30,percent:100});
  assert.deepEqual(forecastCoverage({actual:80,annualConfirmed:30},100),{need:20,balance:-10,percent:100});
  assert.deepEqual(forecastCoverage({actual:-10,annualConfirmed:0},100),{need:110,balance:110,percent:0});
  assert.equal(forecastCoverage({actual:0.1,annualConfirmed:0.1},0.3).balance,0.1);
});
