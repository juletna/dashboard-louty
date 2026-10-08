import { clientGroups, normalizedName } from './clients.js';

const cents = value => Math.round(value * 100);
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const confirmed = d => /^confirme(?:\s|$)/.test(normalizedName(d.state).normalize('NFD').replace(/\p{Diacritic}/gu, ''));
const valid = d => !d.duplicate && confirmed(d) && Number.isFinite(d.amount) && dateValid(d.date);
const positive = d => valid(d) && d.amount > 0;
const knownTTC = d => Number.isFinite(d.amount_ttc) && d.amount_ttc > 0;
const paidAdvance = d => positive(d) && knownTTC(d) && Number.isFinite(d.paid) && cents(d.paid) === cents(d.amount_ttc);
const invoices = new Set(['Facture', 'Facture de situation']);
const total = (ds, field) => ds.reduce((n, d) => n + cents(d[field]), 0);

// Fail closed: a unique result discovered before the budget expires is not proof
// of uniqueness. Counts and visits are explicit and independently testable.
export function exactBillingSets(quote, pool, { maxDocuments = 18, maxVisits = 100000 } = {}) {
  if (!knownTTC(quote) || pool.length > maxDocuments) return { sets: [], exhaustive: false };
  const sets = [];
  let visits = 0, exhaustive = true;
  function visit(i, ht, ttc, selected) {
    if (++visits > maxVisits) { exhaustive = false; return; }
    if (sets.length > 1 || ht > cents(quote.amount) || ttc > cents(quote.amount_ttc)) return;
    if (ht === cents(quote.amount) && ttc === cents(quote.amount_ttc)) {
      const finals = selected.filter(d => d.type === 'Facture');
      const advances = selected.filter(d => d.type === "Facture d'acompte");
      if (finals.length && advances.every(d => paidAdvance(d) && d.date <= finals.map(f => f.date).sort().at(-1))) sets.push(selected);
      return;
    }
    if (i === pool.length) return;
    visit(i + 1, ht, ttc, selected);
    if (exhaustive) visit(i + 1, ht + cents(pool[i].amount), ttc + cents(pool[i].amount_ttc), [...selected, pool[i]]);
  }
  visit(0, 0, 0, []);
  return { sets: exhaustive ? sets : [], exhaustive };
}

// Interpret proposals using billing evidence. This is heuristic allocation, not
// a native Louty link. Deposits and settlement stay separate from forecast CA.
export function classifyBilling(source, candidates) {
  const groups = clientGroups(source);
  const same = (a, b) => groups.resolve(a) !== null && groups.resolve(a) === groups.resolve(b);
  const rows = candidates.map(r => ({ ...r, evidence: [], candidateRemaining: null }));
  const used = new Set();
  const eligibleCandidates = rows.filter(r => ['complete', 'partial'].includes(r.status));
  // Reserve the original allocations simultaneously, even when a candidate
  // becomes a scope question: those invoices cannot be donated to another quote.
  eligibleCandidates.forEach(r => r.matched.forEach(d => used.add(d.key)));
  function complete(r, matched, reason, evidence = []) {
    Object.assign(r, { status: 'complete', proposed: 0, remainingTTC: 0, matched, reason, evidence, eligible: false });
  }
  for (const r of rows) {
    const related = source.filter(d => same(r, d));
    const peers = rows.filter(q => same(r, q) && q.status !== 'complete');
    const clean = r.matched.length && r.matched.every(positive);
    if (['complete', 'partial'].includes(r.status) && !clean) {
      r.status = 'ambiguous'; r.reason = 'unconfirmed-billing';
    } else if (r.status === 'partial' && !r.billingRisk) {
      if (knownTTC(r) && r.matched.every(knownTTC) && total(r.matched, 'amount_ttc') === cents(r.amount_ttc)) {
        complete(r, r.matched, 'ttc-covered');
      } else if (knownTTC(r) && r.matched.every(knownTTC) && total(r.matched, 'amount_ttc') > cents(r.amount_ttc)) {
        r.status = 'ambiguous'; r.reason = 'ttc-excess';
      } else if (r.matched.some(d => d.type === 'Facture')) {
        r.candidateRemaining = r.proposed; r.status = 'ambiguous'; r.reason = 'scope-adjustment';
      } else {
        r.reason = 'progress-remainder';
      }
    } else if (r.status === 'ambiguous' && !r.billingRisk && ['advances-to-link', 'excess-invoices'].includes(r.reason)) {
      const bills = r.matched.filter(d => invoices.has(d.type));
      const advances = r.advanceCandidates;
      const soleOutstanding = peers.length === 1;
      const unallocated = ds => ds.every(d => !used.has(d.key));
      const cleanBills = bills.length && bills.every(positive) && unallocated(bills);
      const finals = bills.filter(d => d.type === 'Facture');
      // A deposit alone is never billing coverage, including a fully paid one.
      const noBilling = !related.some(d => (invoices.has(d.type) || d.type === 'Avoir') && (!dateValid(d.date) || d.date >= r.date));
      const uniqueAdvances = advances.every(a => candidates.filter(q => same(r, q) && q.status !== 'complete' && dateValid(q.date) && a.date >= q.date).length === 1);
      if (noBilling && soleOutstanding && uniqueAdvances && advances.length && advances.every(paidAdvance) && knownTTC(r) &&
          total(advances, 'amount_ttc') < cents(r.amount_ttc) && unallocated(advances)) {
        Object.assign(r, { status: 'unmatched', proposed: r.amount, matched: [], evidence: advances, reason: 'deposit-only' });
        advances.forEach(d => used.add(d.key));
      } else if (soleOutstanding && cleanBills) {
        // Situations are deducted alone: adding deposits here would bill twice.
        if (knownTTC(r) && bills.every(knownTTC) && total(bills, 'amount_ttc') === cents(r.amount_ttc)) {
          complete(r, bills, 'ttc-covered'); bills.forEach(d => used.add(d.key));
        } else if (bills.every(d => d.type === 'Facture de situation')) {
          const ht = cents(r.amount) - total(bills, 'amount');
          const ttc = knownTTC(r) && bills.every(knownTTC) ? cents(r.amount_ttc) - total(bills, 'amount_ttc') : null;
          if (ht <= 0 || ttc === 0) complete(r, bills, ttc === 0 && ht > 0 ? 'ttc-covered' : 'billed-at-least-quote');
          else if (ttc === null || ttc > 0) Object.assign(r, { status: 'partial', proposed: ht / 100, matched: bills, reason: 'progress-remainder' });
          else { r.reason = 'ttc-excess'; }
          bills.forEach(d => used.add(d.key));
        } else {
          const safeAdvances = !advances.length || (rows.filter(q => same(r, q)).length === 1 && finals.length && knownTTC(r) && bills.every(knownTTC) &&
            advances.every(d => paidAdvance(d) && d.date <= finals.map(f => f.date).sort().at(-1)) && unallocated(advances));
          const coverage = [...bills, ...advances];
          if (safeAdvances && (total(coverage, 'amount') >= cents(r.amount) || knownTTC(r) && coverage.every(knownTTC) && total(coverage, 'amount_ttc') === cents(r.amount_ttc))) {
            complete(r, coverage, 'billed-at-least-quote'); coverage.forEach(d => used.add(d.key));
          } else if (total(bills, 'amount') < cents(r.amount)) {
            r.reason = 'scope-adjustment';
            r.candidateRemaining = (cents(r.amount) - total(bills, 'amount')) / 100;
            r.matched = bills; bills.forEach(d => used.add(d.key));
          }
        }
      }
    }
  }
  // Evaluate all proposals before applying any: competing claims disqualify both.
  const applyUnique = proposals => {
    const counts = new Map();
    for (const p of proposals) for (const d of p.evidence.length ? p.evidence : p.matched) counts.set(d.key, (counts.get(d.key) || 0) + 1);
    for (const p of proposals) {
      const documents = p.evidence.length ? p.evidence : p.matched;
      if (documents.every(d => counts.get(d.key) === 1 && !used.has(d.key))) {
        complete(p.row, p.matched, p.reason, p.evidence); documents.forEach(d => used.add(d.key));
      }
    }
  };
  const pool = q => source.filter(d => same(q, d) && (invoices.has(d.type) || d.type === "Facture d'acompte") &&
    positive(d) && knownTTC(d) && d.date >= q.date && !used.has(d.key)).sort((a,b) => a.key.localeCompare(b.key));
  const exact = [];
  for (const r of rows.filter(r => r.status === 'ambiguous' && !r.billingRisk && ['competing-quotes', 'advances-to-link'].includes(r.reason))) {
    const result = exactBillingSets(r, pool(r));
    r.searchExhaustive = result.exhaustive;
    if (result.exhaustive && result.sets.length === 1) exact.push({ row: r, matched: result.sets[0], reason: 'unique-exact-document-group', evidence: [] });
  }
  applyUnique(exact);
  const excess = [];
  for (const r of rows.filter(r => r.status === 'ambiguous' && !r.billingRisk && r.searchExhaustive !== false)) {
    const remaining = pool(r);
    if (rows.filter(q => same(q, r) && q.status !== 'complete').length === 1 && remaining.length === 1 &&
        remaining[0].type === 'Facture' && cents(remaining[0].amount) >= cents(r.amount)) {
      excess.push({ row: r, matched: remaining, reason: 'remaining-invoice-covers-quote', evidence: [] });
    }
  }
  applyUnique(excess);
  for (const r of rows.filter(r => r.status === 'ambiguous' && !r.billingRisk && r.searchExhaustive !== false)) {
    if (!rows.some(q => same(q, r) && q.reason === 'unique-exact-document-group') ||
        rows.filter(q => same(q, r) && q.status !== 'complete').length !== 1) continue;
    const remaining = pool(r);
    if (!remaining.length || !remaining.every(d => d.type === 'Facture de situation')) continue;
    const ht = cents(r.amount) - total(remaining, 'amount');
    const ttc = cents(r.amount_ttc) - total(remaining, 'amount_ttc');
    if (ht <= 0 || ttc === 0) complete(r, remaining, 'billed-at-least-quote');
    else if (ttc > 0) Object.assign(r, { status: 'partial', proposed: ht / 100, matched: remaining, reason: 'progress-remainder' });
    else continue;
    remaining.forEach(d => used.add(d.key));
  }

  const chains = [];
  for (const r of rows.filter(r => r.status === 'ambiguous' && r.reason === 'credit-history' && !r.duplicate && dateValid(r.date) && r.amount > 0 && knownTTC(r))) {
    const alternatives = [];
    const originals = source.filter(d => same(r, d) && d.type === 'Facture' && positive(d) && knownTTC(d) && d.date >= r.date && cents(d.amount) === cents(r.amount) && !used.has(d.key));
    for (const initial of originals) {
      const credits = source.filter(d => same(initial, d) && d.type === 'Avoir' && valid(d) && Number.isFinite(d.amount_ttc) &&
        d.date >= initial.date && cents(d.amount) === -cents(initial.amount) && cents(d.amount_ttc) === -cents(initial.amount_ttc) && !used.has(d.key));
      for (const credit of credits) {
        const replacements = source.filter(d => d.activity === r.activity && normalizedName(r.client) && normalizedName(d.client) === normalizedName(r.client) &&
          d.type === 'Facture' && positive(d) && knownTTC(d) && d.key !== initial.key && d.date >= credit.date &&
          cents(d.amount) === cents(r.amount) && cents(d.amount_ttc) === cents(r.amount_ttc) && !used.has(d.key));
        for (const replacement of replacements) alternatives.push({ row: r, matched: [replacement], evidence: [initial, credit, replacement], reason: 'cancelled-and-replaced-invoice' });
      }
    }
    if (alternatives.length === 1) chains.push(alternatives[0]);
  }
  applyUnique(chains);
  for (const r of rows) {
    if (['ambiguous', 'no-id'].includes(r.status)) {
      r.proposed = null;
      if (!r.candidateRemaining) r.matched = r.matched.filter(d => !used.has(d.key));
      r.matched = r.matched.filter(d => d.type !== "Facture d'acompte");
    }
    const billed = r.matched.filter(d => invoices.has(d.type) || d.type === "Facture d'acompte");
    r.billedHT = billed.length && billed.every(d => Number.isFinite(d.amount)) ? total(billed, 'amount') / 100 : null;
    r.differenceHT = r.billedHT === null ? null : (total(billed, 'amount') - cents(r.amount)) / 100;
    r.differenceTTC = knownTTC(r) && billed.length && billed.every(knownTTC) ? (total(billed, 'amount_ttc') - cents(r.amount_ttc)) / 100 : null;
    if (r.status === 'partial' && r.differenceTTC !== null) r.remainingTTC = -r.differenceTTC;
    if (r.status === 'complete') {
      r.minorTtcDifference = r.differenceTTC !== null && Math.abs(r.differenceTTC) <= 1 ? r.differenceTTC : null;
      r.warning = r.differenceTTC === null ? 'TTC facturé indisponible' : Math.abs(r.differenceTTC) > 1 ? 'Écart TTC conservé : vérifier les pièces' : null;
    }
    r.eligible = r.status !== 'complete';
    // Version the interpretation and all relevant evidence, including states,
    // acceptance and cross-ID cancellation chains. Legacy choices remain stored
    // but require one review if their previous interpretation is no longer valid.
    const related = source.filter(d => d.activity === r.activity && (same(r, d) || normalizedName(r.client) && normalizedName(r.client) === normalizedName(d.client)));
    r.fingerprint = JSON.stringify([r.fingerprint, 'billing-v1', r.status, r.proposed, r.reason,
      related.sort((a,b) => a.key.localeCompare(b.key)).map(d => [d.key, d.amount, d.amount_ttc ?? null, d.date, d.state, d.agreement_date ?? null, d.paid ?? null, d.client_id, d.duplicate]),
      r.matched.map(d => d.key).sort(), r.evidence.map(d => d.key).sort()]);
  }
  return rows;
}
