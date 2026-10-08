import test from 'node:test';
import assert from 'node:assert/strict';
import { renderForecastSummary } from '../src/app/views/forecast-summary.js';
const render = (actual, confirmed, goal) => renderForecastSummary({summary:{actual,confirmed,year:'2026',waiting:0,validation:0,reviewCount:0,unintegrated:[]},goal,reviewCount:0,reviewAmount:0,reviewUnknown:0,warning:'',expanded:false,search:'',tables:'',activeTab:'confirmed',counts:{confirmed:0,waiting:0,validation:0,review:0},money:String,escape:String});
test('coverage presentation preserves zero and unavailable actuals',()=>{
  for(const [actual,estimated,goal] of [[0,0,0],[0,30,0],[120,30,100],[null,30,100]]) {
    const html=render(actual,estimated,goal);
    assert.doesNotMatch(html,/NaN|Infinity|undefined/);
  }
  assert.match(render(null,30,100),/Besoin indisponible/);
  assert.doesNotMatch(render(null,30,100),/class="forecast-coverage-track/);
  assert.match(render(0,30,0),/at-start/);
});
test('coverage presentation distinguishes remaining need, exact coverage and excess',()=>{
  assert.match(render(40,30,100),/shortfall/);
  assert.match(render(40,30,100),/Reste à trouver/);
  assert.match(render(40,60,100),/at-end/);
  assert.doesNotMatch(render(40,60,100),/class="forecast-excess"/);
  const excess=render(40,80,100);
  assert.match(excess,/class="forecast-excess" style="width:25%"/);
  assert.match(excess,/width:75%/);
  assert.match(excess,/\+20 HT/);
});
