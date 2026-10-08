import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareDocuments, reconcileForecast, forecastStatus, forecastSummary, matchQuoteCandidates } from '../src/app/domain/forecast.js';
import { exactBillingSets } from '../src/app/domain/forecast-billing.js';
import { createForecastStorage } from '../src/app/state/forecast.js';

const doc = (number, type, amount, amount_ttc, extra = {}) => ({ number, type, amount, amount_ttc,
  state: type === 'Devis' ? 'Validé & imp.' : 'Confirmé', activity: 'FICTION', client_id: 'C1', client: 'Client fictif',
  date: type === 'Devis' ? '2026-01-01' : '2026-02-01', agreement_date: type === 'Devis' ? '2026-01-05' : null, paid: 0, title: 'Travaux fictifs', ...extra });
const q = doc('Q', 'Devis', 100, 120);
const a = doc('A', "Facture d'acompte", 25, 30, { paid: 30 });
const bill = (amount, ttc, extra) => doc('F', 'Facture', amount, ttc, extra);
const progress = (amount, ttc, extra) => doc('S', 'Facture de situation', amount, ttc, extra);
const run = (ds, choices = new Map()) => reconcileForecast(prepareDocuments(ds), choices);
const choice = (r, extra = {}) => ({ action: 'include', situation: 'confirmed', remaining: r.proposed ?? 30, month: null, fingerprint: r.fingerprint, quote: r, ...extra });
const data = { snapshot: { current: { year: '2026' } }, years: { 2026: { months_present: [1,2], monthly: { ca: [10,20,...Array(10).fill(null)] } } } };

test('paid advance alone is deducted from the HT remainder because RES already holds it', () => {
  const [r] = run([q,a]);
  assert.equal(r.advanceDeductedHT,25); assert.equal(run([q])[0].advanceDeductedHT,0);
  assert.equal(r.proposed,75); assert.equal(r.remainingTTC,90); assert.equal(r.auto,true); assert.equal(r.choice.month,null);
  assert.equal(forecastStatus(r),'Confirmé · À facturer');
  const s = forecastSummary([r],data,1000);
  assert.equal(s.confirmed,75); assert.equal(s.annualConfirmed,75);
  for (const patch of [{paid:29.99},{state:'Attente valid.'},{date:'2025-01-01'},{amount_ttc:null}]) {
    const [next] = run([q,{...a,...patch}]);
    if (patch.date) assert.equal(next.proposed,100); else assert.equal(next.auto,false);
  }
  assert.ok(run([q,{...q,number:'Q2',amount:200,amount_ttc:240},a]).every(r=>!r.auto));
});

test('situations are net of the deposit they take back, so the paid deposit counts as billed', () => {
  const [r] = run([q,a,progress(20,24),{...progress(30,36),number:'S2'}]);
  assert.equal(r.proposed,25); assert.equal(r.advanceDeductedHT,25); assert.equal(r.remainingTTC,30); assert.equal(r.choice.remaining,25); assert.equal(r.billedHT,75);
  assert.equal(forecastStatus(r),'Confirmé · Partiellement facturé');
  assert.equal(r.matched.filter(d=>d.type==="Facture d'acompte").length,1);
  // A deposit issued after the situations has not been taken back yet.
  const [later] = run([q,{...a,date:'2026-03-01'},progress(20,24),{...progress(30,36),number:'S2'}]);
  assert.equal(later.proposed,50); assert.ok(later.matched.every(d=>d.type==='Facture de situation'));
  assert.equal(run([q,progress(40,48,{state:'Non confirmé'})])[0].auto,false);
});

test('ordinary final invoices below quote preserve candidate scope remainder outside totals', () => {
  for (const ds of [[q,bill(90,108)], [q,bill(70,84),{...a,amount:10,amount_ttc:12,paid:12}]]) {
    const [r] = run(ds);
    assert.equal(forecastStatus(r),'À vérifier'); assert.equal(r.proposed,null); assert.equal(r.auto,false);
    assert.equal(r.candidateRemaining,ds[1].amount===90?10:30);
    assert.equal(r.differenceHT,ds[1].amount-100);
    assert.equal(forecastSummary([r],data,1000).confirmed,0);
    assert.ok(r.matched.every(d=>d.type!=='Facture d\'acompte'));
  }
});

test('full HT coverage and supplements never create negative forecast, settlement independent', () => {
  for (const ds of [[q,bill(110,132)],[q,a,bill(85,102)]]) {
    const [r] = run(ds);
    assert.equal(r.status,'complete'); assert.equal(r.proposed,0); assert.equal(forecastStatus(r),'Entièrement facturé');
    assert.equal(r.auto,false); assert.ok(r.differenceHT>0);
  }
});

test('TTC equality closes HT differences and never counts a deposit twice', () => {
  const [r] = run([q,bill(90,120),{...a,amount:10,amount_ttc:12,paid:12}]);
  assert.equal(r.status,'complete'); assert.equal(r.reason,'ttc-covered'); assert.equal(r.matched.length,1);
  assert.equal(r.differenceHT,-10); assert.equal(r.differenceTTC,0);
  const [same] = run([q,bill(90,120)]); assert.equal(same.proposed,0);
  assert.equal(run([q,bill(99.5,119.4)])[0].candidateRemaining,.5);
  assert.equal(run([q,progress(99.5,119.4)])[0].proposed,.5);
});

test('minor TTC differences retain exact detail through the inclusive one-euro boundary', () => {
  for (const delta of [.02,.04,1,-1]) {
    const [r] = run([q,bill(100,120+delta)]);
    assert.equal(r.minorTtcDifference,delta); assert.equal(r.warning,null); assert.equal(r.proposed,0);
  }
  const [r] = run([q,bill(100,121.01)]);
  assert.ok(r.warning); assert.equal(r.proposed,0);
  assert.equal(run([q,progress(90,121)])[0].proposed,null);
});

const grouped = [q,{...a,amount:20,amount_ttc:24,paid:24},doc('Q2','Devis',200,240),bill(80,96),doc('F2','Facture',210,252)];
test('unique exact sets then remaining invoice allocate every document once and independently of order', () => {
  const rs = run(grouped);
  assert.deepEqual(rs.map(r=>r.status),['complete','complete']);
  assert.equal(rs[0].reason,'unique-exact-document-group'); assert.equal(rs[1].reason,'remaining-invoice-covers-quote');
  const projection = rs => rs.map(r=>[r.key,r.status,r.proposed,r.fingerprint]).sort();
  assert.deepEqual(projection(run([...grouped].reverse())),projection(rs));
  const keys = rs.flatMap(r=>r.matched.map(d=>d.key)); assert.equal(keys.length,new Set(keys).size);
});

test('situations left after exact elimination give a partial remainder without reusing pieces', () => {
  const rs = run([...grouped.slice(0,-1),progress(50,60)]);
  assert.equal(rs[0].status,'complete'); assert.equal(rs[1].proposed,150); assert.equal(rs[1].remainingTTC,180);
  assert.equal(rs[1].matched.length,1); assert.equal(rs[1].matched[0].number,'S');
});

test('multiple combinations, contested pieces and search limits fail closed', () => {
  assert.ok(run([...grouped,{...bill(80,96),number:'F3'}]).every(r=>r.status==='ambiguous'));
  assert.ok(run([q,{...q,number:'Q2'},a,bill(75,90)]).every(r=>r.status==='ambiguous'));
  const pool = prepareDocuments([a,bill(75,90)]);
  assert.equal(exactBillingSets(q,pool).sets.length,1);
  assert.equal(exactBillingSets(q,pool,{maxVisits:1}).exhaustive,false);
  assert.equal(exactBillingSets(q,pool,{maxDocuments:1}).exhaustive,false);
  const many = Array.from({length:19},(_,i)=>doc('F'+i,'Facture',1,1.2));
  assert.equal(exactBillingSets(q,many).exhaustive,false);
});

const chain = [{...q,amount_ttc:110},bill(100,120),doc('C','Avoir',-100,-120),doc('R','Facture',100,110,{client_id:'C2',date:'2026-02-02'})];
test('unique integral cancellation and replacement allows traced ID change without merging clients', () => {
  const [r] = run(chain);
  assert.equal(r.status,'complete'); assert.equal(r.reason,'cancelled-and-replaced-invoice'); assert.equal(r.evidence.length,3);
  assert.equal(r.matched[0].client_id,'C2'); assert.equal(r.client_id,'C1');
  assert.deepEqual(run([...chain].reverse()).map(r=>r.fingerprint),[r.fingerprint]);
});

test('partial credits, wrong amounts/dates/activity/names and competing replacements never close a quote', () => {
  for (const [index,patch] of [[2,{amount:-90}],[2,{amount_ttc:-119}],[2,{date:'2026-03-01'}],
    [3,{client:'Autre client fictif'}],[3,{activity:'OTHER'}],[3,{date:'2026-02-30'}],[3,{state:'Attente valid.'}]]) {
    assert.equal(run(chain.map((d,i)=>i===index?{...d,...patch}:d))[0].status,'ambiguous');
  }
  assert.equal(run([...chain,{...chain[3],number:'R2'}])[0].status,'ambiguous');
  assert.ok(run([...chain,{...chain[0],number:'Q2'}]).every(r=>r.status==='ambiguous'));
});

test('manual decisions persist, remain prioritary, and reimports suspend changed evidence', () => {
  const [r] = run([q,a]); let raw;
  const storage = {getItem:()=>raw??null,setItem:(_,v)=>{raw=v;}};
  const cache=createForecastStorage(storage);
  cache.set(r.key,choice(r,{remaining:72,month:'2026-10'}));
  const choices=createForecastStorage(storage).choices;
  const [same]=run([a,q],choices); assert.equal(same.review,false); assert.equal(same.choice.remaining,72); assert.equal(same.auto,false);
  for (const patch of [{paid:25},{state:'Non confirmé'},{amount_ttc:31}]) {
    const [next]=run([q,{...a,...patch}],choices); assert.equal(next.review,true); assert.equal(next.choice.remaining,72);
    assert.equal(forecastSummary([next],data,1000).confirmed,0);
  }
  assert.equal(run([],choices)[0].missing,true);
  cache.set(r.key,choice(r,{action:'exclude'})); assert.equal(run([q,a],cache.choices)[0].auto,false);
  const old=matchQuoteCandidates(prepareDocuments([q,a]))[0];
  assert.equal(run([q,a],new Map([[r.key,choice(old,{remaining:72})]]))[0].review,true);
});

test('same-name cross-ID coverage is a persistent manual decision, conflicting claims need review', () => {
  const ds=[q,{...q,number:'Q2'},bill(90,120,{client_id:'C2'})];
  const rs=run(ds); assert.ok(rs.every(r=>forecastStatus(r)==='À vérifier'));
  const decision=r=>({action:'exclude',billed:true,billingKeys:r.probableInvoices.map(d=>d.key),fingerprint:r.fingerprint,quote:r});
  const choices=new Map([[rs[0].key,decision(rs[0])]]);
  assert.equal(forecastStatus(run(ds,choices)[0]),'Entièrement facturé');
  choices.set(rs[1].key,decision(rs[1]));
  assert.ok(run(ds,choices).every(r=>r.review&&r.allocationConflict&&forecastStatus(r)==='À vérifier'));
  const changed=run([q,bill(90,120,{client_id:'C2',state:'Attente valid.'})],new Map([[rs[0].key,decision(rs[0])]]));
  assert.equal(changed[0].review,true);
});

test('manual amount decides scope review; legacy schedule does not alter uniform distribution', () => {
  const [r]=run([q,bill(90,108)]);
  for (const [month,expected] of [[null,10],['2026-02',10],['2026-03',10],['2027-03',10]]) {
    const [manual]=run([q,bill(90,108)],new Map([[r.key,choice(r,{remaining:10,month})]]));
    const s=forecastSummary([manual],data,1000);
    assert.equal(s.confirmed,10); assert.equal(s.annualConfirmed,expected); assert.equal(s.actual,30);
    assert.equal(forecastStatus(manual),'Confirmé · Partiellement facturé');
  }
});
