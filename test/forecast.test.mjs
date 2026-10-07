import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareDocuments, matchQuotes, reconcileForecast, forecastSummary } from '../src/app/domain/forecast.js';
import { createForecastStorage, FORECAST_KEY } from '../src/app/state/forecast.js';
import { parseExportDate } from '../src/app/state/import.js';
import { parsePieces } from '../src/app/parser.js';

function doc(number, amount, type = 'Devis', extra = {}) {
  return { number, amount, type, client_id: '001', client: 'Client fictif', activity: 'ACT',
    date: type === 'Devis' ? '2026-01-01' : '2026-02-01', title: number, state: 'Validé & imp.', ...extra };
}
const match = input => matchQuotes(prepareDocuments(input));
const choice = (row, extra = {}) => ({ action: 'include', quote: row, fingerprint: row.fingerprint,
  remaining: 100, situation: 'confirmed', month: '2026-10', ...extra });

test('matching excludes drafts but never relies on agreement or validation status', () => {
  const result = match([doc('draft', 12, 'Devis', { state: 'Brouillon' }), doc('q', 100, 'Devis', { state: 'Attente valid.' }), doc('f', 100, 'Facture', { state: 'Ancien état' })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'complete');
});
test('missing IDs fall back to exact names within the same activity', () => {
  assert.equal(match([doc('q', 100, 'Devis', { client_id: '' }), doc('f', 100, 'Facture', { client_id: '' })])[0].status, 'complete');
  assert.equal(match([doc('q', 100), doc('f', 100, 'Facture', { activity: 'OTHER' })])[0].status, 'unmatched');
});

test('names bridge missing IDs in either direction, ignoring only case and whitespace', () => {
  for (const [qid, fid] of [['', '001'], ['001', ''], ['', '']]) {
    const row = match([doc('q', 100, 'Devis', { client_id: qid, client: '  Martin   Alice ' }), doc('f', 40, 'Facture', { client_id: fid, client: 'MARTIN Alice' })])[0];
    assert.equal(row.status, 'partial'); assert.equal(row.proposed, 60); assert.equal(row.matchBasis, 'name');
  }
  for (const client of ['Alice Martin', 'Martin Alise', '']) {
    assert.notEqual(match([doc('q', 100, 'Devis', { client_id: '', client: 'Martin Alice' }), doc('f', 100, 'Facture', { client_id: '', client })])[0].status, 'complete');
  }
  assert.equal(match([doc('q', 100, 'Devis', { client_id: '', client: '  ' })])[0].status, 'no-id');
});
test('known IDs take priority; shared names never merge distinct clients', () => {
  assert.equal(match([doc('q', 100), doc('f', 100, 'Facture', { client_id: '002' })])[0].status, 'unmatched');
  const documents = [doc('q', 100, 'Devis', { client_id: '' }), doc('f1', 100, 'Facture'), doc('f2', 30, 'Facture', { client_id: '002' }), doc('q2', 100)];
  const rows = match(documents);
  assert.ok(rows.every(r => r.status === 'ambiguous' && r.nameConflict && !r.matched.length));
  assert.deepEqual(match([...documents].reverse()).sort((a,b) => a.number.localeCompare(b.number)), [...rows].sort((a,b) => a.number.localeCompare(b.number)));
});
test('ID and name quotes share one invoice pool and detect competitors', () => {
  const rows = match([doc('q1', 100), doc('q2', 200, 'Devis', { client_id: '' }), doc('f1', 100, 'Facture'), doc('f2', 60, 'Facture', { client_id: '' })]);
  assert.equal(rows[0].status, 'complete'); assert.equal(rows[1].proposed, 140);
  assert.equal(new Set(rows.flatMap(r => r.matched.map(b => b.key))).size, 2);
  assert.ok(match([doc('q1', 100), doc('q2', 100, 'Devis', { client_id: '' }), doc('f', 100, 'Facture')]).every(r => r.status === 'ambiguous'));
});
test('identity changes invalidate saved proposals without changing manual amounts', () => {
  const input = [doc('q', 100, 'Devis', { client_id: '' }), doc('f', 40, 'Facture')];
  const row = match(input)[0], choices = new Map([[row.key, choice(row, { remaining: 70 })]]);
  const changed = reconcileForecast(prepareDocuments([...input, doc('f2', 20, 'Facture', { client_id: '002' })]), choices)[0];
  assert.equal(changed.review, true); assert.equal(changed.choice.remaining, 70);
  const old = choice(row, { fingerprint: 'previous-matching-rule' });
  assert.equal(reconcileForecast(prepareDocuments(input), new Map([[row.key, old]]))[0].review, true);
});

test('elimination allocates each invoice once, exact before partial sums', () => {
  const rows = match([doc('q1', 100), doc('q2', 500), doc('f1', 100, 'Facture'), doc('f2', 150, 'Facture de situation'), doc('f3', 200, 'Facture de situation')]);
  assert.equal(rows[0].status, 'complete');
  assert.equal(rows[1].status, 'partial');
  assert.equal(rows[1].proposed, 150);
  assert.equal(new Set(rows.flatMap(r => r.matched.map(b => b.key))).size, 3);
  const reversed = match([doc('f3', 200, 'Facture de situation'), doc('q2', 500), doc('f2', 150, 'Facture de situation'), doc('q1', 100), doc('f1', 100, 'Facture')]);
  assert.equal(reversed.find(r => r.number === 'q2').proposed, 150);
});
test('duplicate amounts and competing quotes stay ambiguous and cannot donate their invoice', () => {
  const rows = match([doc('q1', 100), doc('q2', 100), doc('q3', 200), doc('f', 100, 'Facture')]);
  assert.ok(rows.every(r => r.status === 'ambiguous' && r.eligible));
});
test('deposits, credits, invalid invoices and prior invoices never silently reduce a quote', () => {
  for (const extra of [doc('a', 40, "Facture d'acompte"), doc('a', -20, 'Avoir'), doc('a', null, 'Facture'), doc('a', 30, 'Facture', { date: null })]) {
    const r = match([doc('q', 100), doc('f', 40, 'Facture'), extra])[0];
    assert.equal(r.status, 'ambiguous'); assert.equal(r.proposed, 100);
  }
  assert.equal(match([doc('q', 100), doc('f', 100, 'Facture', { date: '2025-12-01' })])[0].status, 'unmatched');
});
test('cent rounding, identical document IDs and unnumbered identities are deterministic', () => {
  assert.equal(match([doc('q', .3), doc('f1', .1, 'Facture'), doc('f2', .2, 'Facture')])[0].status, 'complete');
  const duplicates = match([doc('q', 100), doc('q', 100), doc('f', 100, 'Facture')]);
  assert.equal(duplicates.length, 1); assert.equal(duplicates[0].status, 'ambiguous');
  assert.notEqual(prepareDocuments([doc('', 100)])[0].key, prepareDocuments([doc('', 200)])[0].key);
});
test('choices survive reordered imports, changed invoices require review, missing quotes remain inspectable', () => {
  const input = [doc('q', 100), doc('f', 30, 'Facture')];
  const row = match(input)[0], choices = new Map([[row.key, choice(row)]]);
  assert.equal(reconcileForecast(prepareDocuments([...input].reverse()), choices)[0].review, false);
  const changed = reconcileForecast(prepareDocuments([...input, doc('f2', 20, 'Facture')]), choices)[0];
  assert.equal(changed.review, true); assert.equal(changed.choice.remaining, 100);
  const missing = reconcileForecast([], choices)[0];
  assert.equal(missing.missing, true); assert.equal(missing.choice.remaining, 100);
});
test('annual forecast separates waits, undated, covered months, other years and stale selections', () => {
  const documents = prepareDocuments(Array.from({ length: 6 }, (_, i) => doc('q' + i, 100, 'Devis', { client_id: String(i) })));
  const r = matchQuotes(documents);
  const choices = new Map(r.map((q, i) => [q.key, choice(q, [ {}, { situation: 'waiting' }, { month: null }, { month: '2026-09' }, { month: '2027-01' }, { fingerprint: 'stale' } ][i])]));
  const data = { years: { 2026: { monthly: { ca: [100, null, 200] }, months_present: [1,2,3,4,5,6,7,8,9] } }, snapshot: { current: { year: '2026' } } };
  const s = forecastSummary(reconcileForecast(documents, choices), data, 1000);
  assert.equal(s.confirmed, 400); assert.equal(s.waiting, 100); assert.equal(s.undated, 100);
  assert.equal(s.annualConfirmed, 100); assert.equal(s.actual, 300); assert.equal(s.actualPlusConfirmed, 400);
  assert.equal(s.gap, 600); assert.equal(s.reviewCount, 1); assert.equal(s.coveredCount, 1);
  assert.equal(s.monthly[9], 100); assert.equal(s.monthly[8], null);
  data.years[2026].monthly.ca.fill(null);
  assert.equal(forecastSummary([], data, 1000).actualPlusConfirmed, null);
});
test('forecast storage preserves zero, reloads choices, does not overwrite corrupt cache, reports quota errors', () => {
  let raw = null, fail = false;
  const memory = { getItem: () => raw, setItem: (key, value) => { assert.equal(key, FORECAST_KEY); if (fail) throw Error('quota'); raw = value; } };
  const row = match([doc('q', 100)])[0];
  const s = createForecastStorage(memory);
  assert.equal(s.set(row.key, choice(row, { remaining: 0 })), true);
  assert.equal(createForecastStorage(memory).choices.get(row.key).remaining, 0);
  const old = raw; fail = true;
  assert.equal(s.set(row.key, choice(row, { remaining: 50 })), false);
  assert.equal(raw, old); assert.equal(s.choices.get(row.key).remaining, 50); assert.ok(s.warning);
  fail = false; raw = 'corrupt'; const corrupt = createForecastStorage(memory);
  assert.equal(corrupt.set(row.key, choice(row)), false); assert.equal(raw, 'corrupt');
});
test('Pieces filenames without underscore supply an export date', () => {
  assert.ok(parseExportDate('Pieces261007_131213.xlsx'));
});
test('parser retains unnumbered waiting quotes, missing fields and ID zero, excludes drafts', () => {
  const cells = [
    ['Type','Date','Client','Montant H.T.','Etat','N° client','Numéro chrono'],
    ['Devis','2026-01-01','Fictif',100,'Attente valid.',0,''],
    ['Devis','','Fictif','','Validé & imp.','','MISSING'],
    ['Devis','2026-01-01','Fictif',100,'Brouillon','1','DRAFT'],
  ];
  const sheet = { '!ref': 'A1:G4' };
  cells.forEach((row, r) => row.forEach((v, c) => sheet[`${r}:${c}`] = { v }));
  const XLSX = { utils: { decode_range: () => ({ e: { r: 3, c: 6 } }), encode_cell: ({ r,c }) => `${r}:${c}` } };
  const out = parsePieces(XLSX, { SheetNames: ['P'], Sheets: { P: sheet } });
  assert.equal(out.documents.length, 2); assert.equal(out.documents[0].client_id, '0');
  assert.equal(out.documents[1].amount, null); assert.equal(out.documents[1].date, null);
});

test('conflicting unidentified invoices remain in the review fingerprint without allocation', () => {
  const input = [doc('q', 100), doc('other', 100, 'Devis', {client_id:'002'}), doc('f', 30, 'Facture', {client_id:''})];
  const row = match(input)[0];
  assert.equal(row.status, 'ambiguous'); assert.equal(row.matched.length, 0);
  const choices = new Map([[row.key, choice(row, {remaining:70})]]);
  const changed = input.map(d => d.number === 'f' ? {...d, amount:50} : d);
  const next = reconcileForecast(prepareDocuments(changed), choices)[0];
  assert.equal(next.review, true); assert.equal(next.choice.remaining, 70);
});

test('unidentified conflicting quote also tracks invoices bearing either known ID', () => {
  const input = [doc('q', 100, 'Devis', {client_id:''}), doc('a', 30, 'Facture'), doc('b', 20, 'Facture', {client_id:'002'})];
  const row = match(input)[0], choices = new Map([[row.key, choice(row)]]);
  for (const number of ['a', 'b']) {
    const changed = input.map(d => d.number === number ? {...d, amount:50} : d);
    assert.equal(reconcileForecast(prepareDocuments(changed), choices)[0].review, true);
  }
});

test('repeated quote amounts resolve collectively only with a complete date-compatible bijection', () => {
  const input = [doc('q1', 100), doc('q2', 100, 'Devis', {date:'2026-03-01'}),
    doc('f1', 100, 'Facture'), doc('f2', 100, 'Facture', {date:'2026-04-01'}),
    doc('q3', 400), doc('f3', 50, 'Facture')];
  const rows = match(input);
  assert.deepEqual(rows.map(r => [r.status, r.proposed]), [['complete',0],['complete',0],['partial',350]]);
  assert.ok(rows.slice(0,2).every(r => r.groupMatch));
  assert.equal(new Set(rows.flatMap(r => r.matched.map(b => b.key))).size, 3);
  assert.deepEqual(match([...input].reverse()).sort((a,b) => a.key.localeCompare(b.key)), [...rows].sort((a,b) => a.key.localeCompare(b.key)));
  for (const invoices of [
    [doc('f1',100,'Facture')],
    [doc('f1',100,'Facture'),doc('f2',100,'Facture')],
    [doc('f1',100,'Facture'),doc('f2',100,'Facture',{date:'2026-04-01'}),doc('f3',100,'Facture',{date:'2026-05-01'})],
  ]) {
    const pending = match([...input.slice(0,2), ...invoices]);
    assert.ok(pending.every(r => r.status === 'ambiguous' && r.reason === 'repeated-amounts' && !r.matched.length));
  }
});

test('agreement auto-includes only usable unmatched or partial quotes, with no invented schedule', () => {
  const q = doc('q',100,'Devis',{agreement_date:'2026-01-15'});
  for (const invoices of [[],[doc('f',40,'Facture')]]) {
    const choices = new Map();
    const [row] = reconcileForecast(prepareDocuments([q,...invoices]), choices);
    assert.equal(row.accepted,true); assert.equal(row.auto,true); assert.equal(row.review,false);
    assert.equal(row.choice.situation,'confirmed'); assert.equal(row.choice.month,null);
    assert.equal(row.choice.remaining,invoices.length ? 60 : 100);
    assert.equal(choices.size,0);
  }
  for (const invoices of [[doc('f',100,'Facture')],[doc('a',40,"Facture d'acompte")],[doc('a',-10,'Avoir')]]) {
    const [row] = reconcileForecast(prepareDocuments([q,...invoices]),new Map());
    assert.equal(row.accepted,true); assert.equal(row.auto,false); assert.equal(row.choice,undefined);
  }
  for (const date of [null,'','not-a-date','2026-02-30','2026-13-01']) {
    const [row] = reconcileForecast(prepareDocuments([{...q,agreement_date:date}]),new Map());
    assert.equal(row.accepted,false); assert.equal(row.choice,undefined);
  }
});

test('manual inclusions and exclusions outrank agreement, including after changed evidence', () => {
  const q=doc('q',100,'Devis',{agreement_date:'2026-01-15'});
  const [original]=match([q]);
  for (const action of ['include','exclude']) {
    const manual=choice(original,{action,remaining:17,situation:'waiting',month:'2027-02'});
    for (const invoices of [[],[doc('f',30,'Facture')]]) {
      const [row]=reconcileForecast(prepareDocuments([q,...invoices]),new Map([[original.key,manual]]));
      assert.equal(row.auto,false); assert.equal(row.choice,manual); assert.equal(row.review,!!invoices.length);
    }
  }
});

test('deposit candidates never reduce CA and changed payment evidence suspends saved choices', () => {
  const input=[doc('q',100,'Devis',{amount_ttc:120,agreement_date:'2026-01-15'}),
    doc('a',25,"Facture d'acompte",{amount_ttc:30,paid:30}),doc('old',20,"Facture d'acompte",{date:'2025-01-01'})];
  const [row]=match(input);
  assert.equal(row.proposed,100); assert.equal(row.reason,'advances-to-link'); assert.equal(row.advanceCandidates.length,1);
  assert.equal(row.invoiceCandidates.length,0); assert.equal(row.billingRisk,false);
  const choices=new Map([[row.key,choice(row,{advanceKeys:[row.advanceCandidates[0].key]})]]);
  for (const patch of [{paid:20},{amount_ttc:31}]) {
    const [changed]=reconcileForecast(prepareDocuments(input.map(d=>d.number==='a'?{...d,...patch}:d)),choices);
    assert.equal(changed.review,true); assert.equal(changed.choice.remaining,100);
  }
  assert.equal(match([...input,doc('f',40,'Facture')])[0].invoiceCandidates.length,1);
  assert.equal(match([...input,doc('credit',-10,'Avoir')])[0].billingRisk,true);
});

test('specific review reasons distinguish evidence defects and competing documents', () => {
  const cases = [
    [[doc('q',100,'Devis',{client_id:'',client:''})],'client-missing'],
    [[doc('q',100),doc('q',100)],'duplicate-document'],
    [[doc('q',100),doc('f',-10,'Avoir')],'credit-history'],
    [[doc('q',100),doc('f',30,'Facture',{date:'2026-02-30'})],'invalid-invoice'],
    [[doc('q',100,'Devis',{date:null})],'quote-date'],
    [[doc('q',0)],'quote-amount'],
    [[doc('q',100),doc('f1',100,'Facture'),doc('f2',100,'Facture')],'multiple-exact-invoices'],
    [[doc('q',100),doc('q2',200),doc('f',30,'Facture')],'competing-quotes'],
    [[doc('q',100),doc('f',150,'Facture')],'excess-invoices'],
  ];
  for (const [input,reason] of cases) assert.equal(match(input)[0].reason,reason);
});

test('confirmed final invoices and paid advances can jointly cover HT and TTC without double allocation', () => {
  // Deliberately fictional amounts; decimal components exercise cent rounding.
  const input = [doc('q',1234.57,'Devis',{amount_ttc:1481.48,agreement_date:'2026-01-05'}),
    doc('a',370.37,"Facture d'acompte",{amount_ttc:444.44,paid:444.44,state:'Confirmé'}),
    doc('f',864.20,'Facture',{amount_ttc:1037.04,paid:1037.04,pending:0,state:'confirmé',date:'2026-03-01'})];
  const [row] = match(input);
  assert.equal(row.status,'complete'); assert.equal(row.reason,'settled-with-advance');
  assert.equal(row.proposed,0); assert.equal(row.eligible,false); assert.equal(row.matched.length,2);
  assert.equal(reconcileForecast(prepareDocuments(input),new Map())[0].auto,false);
  assert.deepEqual(match([...input].reverse()),[row]);
  const split=match([input[0],input[1],
    {...input[2],amount:800,amount_ttc:960},
    doc('s',64.20,'Facture de situation',{amount_ttc:77.04,state:'Confirmé'})]);
  assert.equal(split[0].status,'complete'); assert.equal(split[0].matched.length,3);
  const manual=new Map([[row.key,choice(row,{remaining:99})]]);
  const changed=reconcileForecast(prepareDocuments(input.map(d=>d.number==='a'?{...d,state:'Attente valid.'}:d)),manual)[0];
  assert.equal(changed.review,true); assert.equal(changed.choice.remaining,99);
  const two = match([...input, doc('other',900)]);
  assert.ok(two.every(r => r.status==='ambiguous'));
  const existingComplete = match([...input,doc('other',900),doc('other-final',900,'Facture',{state:'Confirmé',date:'2025-12-01'})]);
  assert.ok(existingComplete.every(r => r.status==='ambiguous'));
  for (const [index,patch] of [
    [0,{amount_ttc:1481.49}], [0,{amount_ttc:null}], [1,{paid:444.43}],
    [1,{state:'Non confirmé'}], [2,{state:'Brouillon'}], [2,{state:'Attente valid.'}],
    [2,{amount_ttc:null}], [1,{date:'2026-04-01'}], [2,{amount:864.19}],
    [2,{type:'Facture de situation'}],
  ]) {
    const [candidate]=match(input.map((d,i) => i===index ? {...d,...patch} : d));
    assert.notEqual(candidate.status,'complete',JSON.stringify([index,patch]));
  }
  const [depositOnly] = match(input.slice(0,2));
  assert.equal(depositOnly.status,'ambiguous'); assert.equal(depositOnly.proposed,1234.57);
  const [withCredit] = match([...input,doc('credit',-10,'Avoir')]);
  assert.equal(withCredit.status,'ambiguous');
  const [fullInvoice] = match(input.map(d => d.number==='f' ? {...d,amount:1234.57,amount_ttc:1481.48} : d));
  assert.equal(fullInvoice.status,'complete'); assert.equal(fullInvoice.matched.length,1);
  assert.equal(fullInvoice.matched[0].number,'f');
  const withExactOther=match([...input,doc('other',900),doc('other-final',900,'Facture',{state:'Confirmé',date:'2026-04-01'})]);
  // A historical deposit could already belong to the other fully invoiced quote.
  assert.equal(withExactOther[0].status,'ambiguous');
  assert.equal(withExactOther.find(r=>r.number==='other').status,'complete');
});

test('an advance potentially settled in another complete quote cannot cover the remaining quote', () => {
  const rows=match([
    doc('q1',100,'Devis',{amount_ttc:120}),doc('q2',200,'Devis',{amount_ttc:240}),
    doc('f1',100,'Facture',{amount_ttc:120,state:'Confirmé'}),doc('f2',150,'Facture',{amount_ttc:180,state:'Confirmé'}),
    doc('a',50,"Facture d'acompte",{amount_ttc:60,paid:60,state:'Confirmé',date:'2026-01-15'}),
  ]);
  assert.equal(rows[0].status,'complete');assert.equal(rows[1].status,'ambiguous');
});

test('different IDs with identical name and TTC require manual confirmation despite agreement', () => {
  const q = doc('Q-TTC', 90, 'Devis', { amount_ttc:99, agreement_date:'2026-01-01' });
  const f = doc('F-TTC', 82.5, 'Facture', { client_id:'002', amount_ttc:99, state:'Confirmé' });
  const documents = prepareDocuments([q,f]);
  const [row] = reconcileForecast(documents, new Map());
  assert.equal(row.reason,'same-name-ttc');
  assert.equal(row.billingRisk,true);
  assert.equal(row.status,'ambiguous');
  assert.equal(row.choice,undefined);
  assert.equal(row.probableInvoices[0].number,'F-TTC');
  assert.equal(row.proposed,90);
  const choices = new Map([[row.key,{action:'exclude',fingerprint:row.fingerprint,quote:row}]]);
  assert.equal(reconcileForecast(documents,choices)[0].choice.action,'exclude');
  const old = match([q])[0];
  const reviewed = reconcileForecast(documents,new Map([[old.key,choice(old)]]))[0];
  assert.equal(reviewed.review,true);
  assert.equal(reviewed.choice.remaining,100);
  for (const extra of [{amount_ttc:100},{date:'2025-01-01'},{activity:'OTHER'},{state:'Brouillon'},{type:"Facture d'acompte"},{client:'Autre client'},{amount_ttc:null},{state:'Non confirmé'}]) {
    assert.equal(match([q,{...f,...extra}])[0].probableInvoices,undefined);
  }
  const alreadyMatched = match([q, f, doc('Q-OTHER',82.5,'Devis',{client_id:'002',amount_ttc:99})]);
  assert.equal(alreadyMatched[0].probableInvoices,undefined);
  assert.equal(alreadyMatched[1].status,'complete');
});
