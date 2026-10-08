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
  const render = (sante, documents) => renderCustomerAdvances(sante,{advances:[]},{money:String,escape:String,documents});
  assert.match(render({acomptes_en_ca:0}),/Réimporte la Balance/);
  assert.match(render({acomptes_en_ca:0,acompte_ca_accounts_present:false}),/Aucun compte d’acompte/);
  assert.match(render({acomptes_en_ca:0,acompte_ca_accounts_present:true}),/Importe les Pièces/);
  assert.match(render(null),/Importe la Balance/);
});
test('open deposits are deducted from the quote, listed, and reconciled with the 7040 Balance accounts', async () => {
  const {renderCustomerAdvances} = await import('../src/app/views/customer-payments.js');
  const {prepareDocuments} = await import('../src/app/domain/forecast.js');
  const doc = (number,type,amount,amount_ttc,extra={}) => ({number,type,amount,amount_ttc,state:type==='Devis'?'Validé & imp.':'Confirmé',activity:'ACT',
    client_id:'C1',client:'Client fictif',date:type==='Devis'?'2026-01-01':'2026-02-01',agreement_date:null,paid:0,title:'t',...extra});
  const documents = prepareDocuments([doc('Q','Devis',100,120),doc('A',"Facture d'acompte",25,30,{paid:30})]);
  const render = sante => renderCustomerAdvances(sante,{advances:[]},{money:String,escape:String,documents});
  const ok = render({acompte_ca_accounts_present:true,acomptes_en_ca:25});
  assert.match(ok,/Client fictif/); assert.match(ok,/reste à facturer net d’acompte 75 HT/); assert.match(ok,/concordent/);
  assert.match(render({acompte_ca_accounts_present:true,acomptes_en_ca:40}),/Écart de 15 HT.*aucun devis/);
  assert.match(render({acompte_ca_accounts_present:true,acomptes_en_ca:10}),/Écart de 15 HT.*déjà repris/);
  const taken = prepareDocuments([doc('Q','Devis',100,120),doc('A',"Facture d'acompte",25,30,{paid:30}),doc('S','Facture de situation',20,24,{paid:24})]);
  assert.match(renderCustomerAdvances({acompte_ca_accounts_present:true,acomptes_en_ca:0},{advances:[]},{money:String,escape:String,documents:taken}),/Aucun acompte encaissé en attente/);
  const settled = prepareDocuments([doc('Q','Devis',100,120),doc('A',"Facture d'acompte",25,30,{paid:30}),doc('F','Facture',75,90,{paid:90,date:'2026-03-01'})]);
  assert.match(renderCustomerAdvances({acompte_ca_accounts_present:true,acomptes_en_ca:0},{advances:[]},{money:String,escape:String,documents:settled}),/Aucun acompte encaissé en attente/);
});
