import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientGroups, normalizedName } from '../src/app/domain/clients.js';
import { paymentDetails, advanceMatches } from '../src/app/domain/payments.js';
import { parseBAL, parsePieces, parsePiecesDate } from '../src/app/parser.js';

const doc = (number, extra = {}) => ({ key: number, number, activity: 'A', client_id: '1',
  client: 'Client Test', type: "Facture d'acompte", state: 'Confirmé', date: '2026-01-01',
  amount: 100, amount_ttc: 120, paid: 120, pending: 0, ...extra });

test('shared identity respects IDs, activities, names and conflicting unknown identities', () => {
  const docs = [doc('a'), doc('b', {client_id: '', client: ' CLIENT   TEST '}), doc('c', {activity:'B'})];
  let groups = clientGroups(docs);
  assert.equal(normalizedName(' CLIENT   TEST '), 'client test');
  assert.equal(groups.resolve(docs[0]), groups.resolve(docs[1]));
  assert.notEqual(groups.resolve(docs[0]), groups.resolve(docs[2]));
  groups = clientGroups([...docs, doc('d', {client_id:'2'})]);
  assert.equal(groups.resolve(docs[1]), null);
  assert.equal(groups.ambiguous(docs[1]), true);
  assert.equal(groups.blocked.has(groups.resolve(docs[0])), true);
});

test('payment amounts use explicit TTC balances without inventing missing data', () => {
  const result = paymentDetails([
    doc('advance'), doc('unpaid', {paid: 0}), doc('unknown', {paid: null}),
    doc('invoice', {type: 'Facture', pending: 40, due_date:'2026-02-01'}),
    doc('unknown-invoice', {type: 'Facture', pending: null}),
    doc('overpaid', {type: 'Facture', pending: -10}),
    doc('draft', {state: 'Brouillon'}), doc('credit', {type:'Avoir', pending: 20}),
  ]);
  assert.equal(result.advances[0].amount, 120);
  assert.equal(result.advances[0].documents[0].amount_ht, 100);
  assert.equal(result.receivables[0].amount, 40);
  assert.equal(result.receivables[0].documents[0].due_date, '2026-02-01');
});

test('payment groups no longer fuse homonyms, distinct activities or unidentified clients', () => {
  const details = paymentDetails([doc('a'), doc('b', {client_id:'2'}),
    doc('c', {client_id:''}), doc('d', {activity:'B'}), doc('e', {client_id:'', client:''}), doc('f', {client_id:'',client:''})]);
  assert.equal(details.advances.length, 6);
  assert.equal(details.advances.reduce((sum,item) => sum+item.amount,0), 720);
  assert.equal(details.advances.find(item => item.documents[0].number === 'c').identity_ambiguous,true);
  const shared = paymentDetails([doc('a'),doc('b', {client_id:'',client:'CLIENT TEST'})]);
  assert.equal(shared.advances.length,1);
  assert.equal(shared.advances[0].amount,240);
});

test('advance balance matching selects individual documents rather than the full client history', () => {
  const details = paymentDetails([doc('old', {paid:300}), doc('new', {paid:120}), doc('other', {client_id:'2', paid:50})]);
  const found = advanceMatches(details.advances, 170);
  assert.equal(found.truncated,false);
  assert.equal(found.solutions.length,1);
  assert.deepEqual(found.solutions[0].map(item => item.documents[0].number).sort(), ['new','other']);
  assert.equal(found.solutions[0].reduce((sum,item) => sum+item.amount,0),170);
  assert.deepEqual(advanceMatches(details.advances,0), {solutions:[],truncated:false});
});

test('advance matching detects alternative combinations and exposes bounded searches', () => {
  const details = paymentDetails([doc('a',{paid:60}),doc('b',{paid:60}),doc('c',{paid:120})]);
  const result = advanceMatches(details.advances,120);
  assert.equal(result.solutions.length,2);
  assert.equal(result.truncated,false);
  assert.equal(advanceMatches(details.advances,120,{maxSolutions:1}).truncated,true);
  assert.equal(advanceMatches(details.advances,120,{maxStates:1}).truncated,true);
  assert.equal(advanceMatches(details.advances,120,{maxOperations:1}).truncated,true);
  const duplicate = paymentDetails([doc('dup',{duplicate:true})]);
  assert.equal(advanceMatches(duplicate.advances,120).solutions.length,0);
});

function workbook(rows) {
  const sheet = {'!ref':'fake'};
  rows.forEach((row,r) => row.forEach((v,c) => {sheet[`${r}:${c}`]={v};}));
  return [{utils:{decode_range:()=>({e:{r:rows.length-1,c:rows[0].length-1}}),encode_cell:({r,c})=>`${r}:${c}`}},
    {SheetNames:['Pieces'],Sheets:{Pieces:sheet}}];
}

test('agreement and due dates validate the actual calendar, preserving missing monetary fields', () => {
  for (const value of ['',null,undefined,0,'2026-02-30','31/04/2026','2026-13-01','n/a','2026-02-30T00:00:00Z']) {
    assert.equal(parsePiecesDate(value),null,String(value));
  }
  assert.equal(parsePiecesDate('29/02/2024').getDate(),29);
  assert.equal(parsePiecesDate('2026-10-07').getMonth(),9);
  const [xlsx, book] = workbook([
    ['Type','Date','Client','Montant H.T.','Etat','Date accord','Date échéance','Montant T.T.C.','Déjà réglé','En attente','Numéro chrono'],
    ['Devis','2026-10-01','Test',100,'Validé','07/10/2026',null,120,0,null,'Q1'],
    ['Facture','2026-10-02','Test',100,'Confirmé','2026-02-30','2026-11-02',120,0,120,'F1'],
    ['Facture',null,'Test',100,'Confirmé',null,null,null,null,50,'F2'],
  ]);
  const result = parsePieces(xlsx,book);
  assert.equal(result.documents[0].agreement_date,'2026-10-07');
  assert.equal(result.documents[0].paid,0);
  assert.equal(result.documents[0].pending,null);
  assert.equal(result.documents[1].agreement_date,null);
  assert.equal(result.documents[1].due_date,'2026-11-02');
  assert.equal(result.documents[2].amount_ttc,null);
  assert.equal(result.documents[2].paid,null);
  assert.equal(result.receivables,undefined);
  assert.equal(result.payment_details.receivables[0].amount,170);
});


test('Balance distinguishes a numeric zero advance account from missing or blank accounts', () => {
  for (const [account, value, expected] of [['41910300',0,true], ['47120000',-100,true],
    ['41910300',null,false], ['47120000','',false], ['51200000',0,false]]) {
    const [xlsx, book] = workbook([['Compte','Libellé','','','','Solde'], [account,'Test',null,null,null,value]]);
    book.Sheets.Rapport = book.Sheets.Pieces;
    const result = parseBAL(xlsx,book);
    assert.equal(result.acompte_accounts_present,expected);
    assert.equal(result.dettes_acomptes_clients,value === -100 ? 100 : 0);
  }
});

test('Balance reads deposits booked as revenue (7040) and counts them as work still owed', () => {
  const [xlsx, book] = workbook([['Compte','Libellé','','','','Solde'],
    ['70401210','Acompte TAUX INTERM',null,null,null,-5250.91], ['70401320','Acompte TAUX NORMAL',null,null,null,-833.33],
    ['70420820','TRAVAUX GROUPE B INTERM',null,null,null,-40000]]);
  book.Sheets.Rapport = book.Sheets.Pieces;
  const result = parseBAL(xlsx,book);
  assert.equal(result.acompte_ca_accounts_present,true);
  assert.equal(result.acomptes_en_ca,6084.24);
  assert.equal(result.dettes_acomptes_clients,0);
  assert.equal(result.dettes_totales,6084.24);
  const [xlsx2, book2] = workbook([['Compte','Libellé','','','','Solde'], ['70420820','Travaux',null,null,null,-100]]);
  book2.Sheets.Rapport = book2.Sheets.Pieces;
  const none = parseBAL(xlsx2,book2);
  assert.equal(none.acompte_ca_accounts_present,false); assert.equal(none.acomptes_en_ca,0);
});
