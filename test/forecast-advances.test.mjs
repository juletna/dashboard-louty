import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forecastAdvances } from '../src/app/domain/forecast-advances.js';
import { validateChoice } from '../src/app/state/forecast.js';
const deposit = { key:'d', paid:1080 };
const row = { key:'q', amount:3000, amount_ttc:3600, advanceCandidates:[deposit], invoiceCandidates:[], choice:{action:'include',advanceKeys:['d']} };
test('linked deposits reduce only the TTC cash remainder, never the HT revenue', () => {
  assert.equal(forecastAdvances(row,[row]).cash,2520);
  assert.equal(row.amount,3000);
  for (const extra of [{amount_ttc:null},{billingRisk:true},{invoiceCandidates:[{key:'f'}]}]) assert.equal(forecastAdvances({...row,...extra},[row]).cash,null);
});
test('deposit assignment rejects missing, unpaid, duplicate, excessive or already reserved payments', () => {
  assert.ok(forecastAdvances(row,[row,{key:'other',choice:{action:'include',advanceKeys:['d']}}]).error);
  for(const extra of [{advanceCandidates:[]},{advanceCandidates:[{...deposit,paid:0}]},{advanceCandidates:[{...deposit,duplicate:true}]},{amount_ttc:100}]) assert.ok(forecastAdvances({...row,...extra},[row]).error);
  assert.equal(forecastAdvances({...row,advanceCandidates:[{...deposit,paid:0}]},[row],[]).error,'');
});
test('legacy choices remain valid, new deposit links validate before persistence', () => {
  const choice = {action:'include',fingerprint:'x',quote:{},situation:'confirmed',remaining:3000,month:null};
  assert.ok(validateChoice(choice)); assert.ok(validateChoice({...choice,advanceKeys:['d']}));
  assert.equal(validateChoice({...choice,advanceKeys:['d','d']}),false);
  assert.equal(validateChoice({...choice,advanceKeys:[3]}),false);
});

test('advance panel distinguishes legacy unknown, absent account and explicit zero balance', async () => {
  const {renderCustomerAdvances} = await import('../src/app/views/customer-payments.js');
  const render = sante => renderCustomerAdvances(sante,{advances:[]},{money:String,escape:String});
  assert.match(render({dettes_acomptes_clients:0}),/Réimporte la Balance/);
  assert.match(render({dettes_acomptes_clients:0,acompte_accounts_present:false}),/ne sont pas renseignés/);
  assert.match(render({dettes_acomptes_clients:0,acompte_accounts_present:true}),/solde comptable est nul/);
});
