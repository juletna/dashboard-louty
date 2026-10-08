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

test('open deposits exclude deposits already taken back and reconcile with the 7040 Balance accounts', async () => {
  const {prepareDocuments, matchQuotes} = await import('../src/app/domain/forecast.js');
  const {openAdvances, advanceReconciliation} = await import('../src/app/domain/forecast-advances.js');
  const doc = (number,type,amount,amount_ttc,extra={}) => ({number,type,amount,amount_ttc,state:type==='Devis'?'Validé & imp.':'Confirmé',activity:'ACT',
    client_id:'C1',client:'Client fictif',date:type==='Devis'?'2026-01-01':'2026-02-01',agreement_date:null,paid:0,title:'t',...extra});
  const open = list => openAdvances(matchQuotes(prepareDocuments(list)));
  const q = doc('Q','Devis',100,120), a = doc('A',"Facture d'acompte",25,30,{paid:30});
  const [one] = open([q,a]);
  assert.equal(one.client,'Client fictif'); assert.equal(one.advanceHT,25); assert.equal(one.remainingHT,75); assert.deepEqual(one.numbers,['A']);
  assert.deepEqual(open([q,a,doc('S','Facture de situation',20,24,{paid:24})]),[]);
  assert.deepEqual(open([q,a,doc('F','Facture',75,90,{paid:90,date:'2026-03-01'})]),[]);
  assert.equal(advanceReconciliation(25,[one]).status,'match');
  assert.deepEqual(advanceReconciliation(40,[one]),{balanceHT:40,piecesHT:25,gapHT:15,status:'balance-higher'});
  assert.equal(advanceReconciliation(10,[one]).status,'pieces-higher');
  assert.equal(advanceReconciliation(undefined,[one]),null);
});
