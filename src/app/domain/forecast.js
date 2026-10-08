import { isPeriodCovered, hasObservedValue } from './schema.js';
import { clientGroups, normalizedName } from './clients.js';
import { classifyBilling } from './forecast-billing.js';

const cents = (value) => Math.round(value * 100);
const money = (value) => Math.round(value * 100) / 100;
export const validMonth = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const isConfirmed = d => /^confirme(?:\s|$)/.test(normalizedName(d.state).normalize('NFD').replace(/\p{Diacritic}/gu, ''));
const billingTypes = new Set(['Facture', 'Facture de situation', "Facture d'acompte", 'Avoir']);

// Numbered documents keep their identity when amounts/titles change. Unnumbered
// quotes use their contents: a changed identity is retained as a missing choice.
export function documentKey(d) {
  return JSON.stringify(d.number ? [d.activity, d.type, d.number] :
    [d.activity, d.type, d.client_id, d.client, d.date, d.title, d.amount]);
}

export function prepareDocuments(documents) {
  const byKey = new Map();
  for (const d of documents) {
    const key = documentKey(d);
    if (byKey.has(key)) { byKey.get(key).duplicate = true; continue; }
    byKey.set(key, { ...d, key, duplicate: false });
  }
  return [...byKey.values()];
}

// A match is a proposal, never a statement of settlement. Names are a fallback
// only when they do not connect distinct IDs. Allocations remain unique.
export function matchQuoteCandidates(documents = []) {
  const quotes = documents.filter(d => d.type === 'Devis' && !/brouillon/i.test(d.state));
  const bills = documents.filter(d => billingTypes.has(d.type) && !/brouillon/i.test(d.state));
  const clients = clientGroups([...quotes, ...bills]);
  const groupKey = clients.resolve;
  const groups = new Map();
  for (const q of quotes) {
    const key = groupKey(q);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  const results = new Map();
  for (const [key, qs] of groups) {
    const clientBills = key === null ? [] : bills.filter(b => groupKey(b) === key).sort((a,b) => a.key.localeCompare(b.key));
    const available = clientBills.filter(b => b.amount > 0 && !b.duplicate && b.type !== "Facture d'acompte");
    const used = new Set();
    const candidates = (q) => available.filter(b => !used.has(b.key) && q.date && b.date && b.date >= q.date);
    const risky = clientBills.some(b => b.type === 'Avoir' || !Number.isFinite(b.amount) || b.amount < 0 || b.duplicate || !validDate(b.date));
    const record = (q, status, matched = [], proposed = q.amount, reason = null, groupMatch = false) => {
      const advanceCandidates = clientBills.filter(b => b.type === "Facture d'acompte" && b.amount > 0 && validDate(q.date) && validDate(b.date) && b.date >= q.date);
      const invoiceCandidates = clientBills.filter(b => ['Facture', 'Facture de situation'].includes(b.type) && (!validDate(q.date) || !validDate(b.date) || b.date >= q.date));
      results.set(q.key, { ...q, status, reason, groupMatch, advanceCandidates, invoiceCandidates, billingRisk: risky || key === null || clients.blocked.has(key) || q.duplicate, hasCredits: clientBills.some(b => b.type === 'Avoir'), accepted: validDate(q.agreement_date), quoteConfirmed: validDate(q.agreement_date), matchBasis: key === null ? null : (!q.client_id || matched.some(b => !b.client_id) ? 'name' : 'id'), nameConflict: clients.ambiguous(q) || clients.blocked.has(key), eligible: status !== 'complete', matched, proposed,
        // Any change in this client's documents asks for review, including a
        // disappeared invoice or another quote competing for its allocation.
        fingerprint: JSON.stringify([q.key, q.title, q.client, q.amount, q.date,
          ...[qs, clientBills].map(part => [...part].sort((a, b) => a.key.localeCompare(b.key))
            .map(d => [d.key, d.amount, d.date, d.duplicate])),
          key, clients.ambiguous(q) || clients.blocked.has(key),
          [...(clients.conflicts.get(key) || [])].sort((a, b) => a.key.localeCompare(b.key))
            .map(d => [d.key, d.amount, d.date, d.client_id, normalizedName(d.client), d.duplicate]),
          ...[qs, clientBills].map(part => [...part].sort((a, b) => a.key.localeCompare(b.key)).map(d => [d.client_id, normalizedName(d.client)])),
          ...(!groupMatch ? [] : [['group-exact-v1', matched.map(d => d.key)]]),
          ...(reason !== 'settled-with-advance' ? [] : [['settled-with-advance-v1', matched.map(d => [d.key, d.state])]]),
          ...(![q, ...clientBills].some(d => d.amount_ttc != null || d.paid != null) ? [] : [['payment-evidence-v1', [q, ...clientBills].sort((a,b) => a.key.localeCompare(b.key)).map(d => [d.key, d.amount_ttc ?? null, d.paid ?? null])]])]) });
    };
    for (const q of qs) {
      let reason = null;
      if (key === null) reason = clients.ambiguous(q) ? 'client-conflict' : 'client-missing';
      else if (clients.blocked.has(key)) reason = 'client-conflict';
      else if (q.duplicate) reason = 'duplicate-document';
      else if (risky) reason = clientBills.some(b => b.type === 'Avoir') ? 'credit-history' : 'invalid-invoice';
      else if (!validDate(q.date)) reason = 'quote-date';
      else if (!Number.isFinite(q.amount) || q.amount <= 0) reason = 'quote-amount';
      if (reason) record(q, reason === 'client-missing' ? 'no-id' : 'ambiguous', [], q.amount, reason);
    }
    // Equal amounts can be resolved collectively only when every quote has
    // one compatible invoice. The sorted bijection is deterministic; it is
    // evidence for the group, not proof of an individual document link.
    const amounts = new Map();
    for (const q of qs.filter(q => !results.has(q.key))) {
      const amount = cents(q.amount);
      if (!amounts.has(amount)) amounts.set(amount, []);
      amounts.get(amount).push(q);
    }
    const chronological = (a,b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key);
    for (const [amount, peers] of amounts) {
      if (qs.some(q => cents(q.amount) === amount && results.has(q.key))) {
        peers.forEach(q => record(q, 'ambiguous', [], q.amount, 'repeated-amounts'));
        continue;
      }
      const exact = available.filter(b => !used.has(b.key) && cents(b.amount) === amount && peers.some(q => b.date >= q.date)).sort(chronological);
      const ordered = [...peers].sort(chronological);
      if (exact.length === ordered.length && ordered.every((q,i) => exact[i].date >= q.date)) {
        ordered.forEach((q,i) => { used.add(exact[i].key); record(q, 'complete', [exact[i]], 0, null, ordered.length > 1); });
      } else if (exact.length) {
        for (const q of peers) record(q, 'ambiguous', [], q.amount,
          peers.length > 1 ? 'repeated-amounts' : 'multiple-exact-invoices');
      }
    }
    const unresolved = qs.filter(q => !results.has(q.key));
    for (const q of unresolved) {
      const remaining = candidates(q);
      const advances = clientBills.filter(b => b.type === "Facture d'acompte" && !used.has(b.key) && b.amount > 0 && q.date && b.date >= q.date);
      if (!remaining.length && !advances.length) { record(q, 'unmatched'); continue; }
      // An explicit final invoice plus fully paid deposits can collectively
      // cover a quote. Require independent HT and TTC agreement, confirmed
      // documents, and chronology; a deposit alone never proves completed work.
      const finalInvoices = remaining.filter(b => b.type === 'Facture');
      const coverage = [...remaining, ...advances];
      const lastFinal = finalInvoices.map(b => b.date).sort().at(-1);
      if (qs.length === 1 && unresolved.length === 1 && !qs.some(other => results.get(other.key)?.status === 'ambiguous') &&
          !risky && advances.length && finalInvoices.length &&
          Number.isFinite(q.amount_ttc) && q.amount_ttc > 0 &&
          coverage.every(b => Number.isFinite(b.amount_ttc) && b.amount_ttc > 0 && isConfirmed(b)) &&
          advances.every(b => b.date <= lastFinal && Number.isFinite(b.paid) && cents(b.paid) === cents(b.amount_ttc)) &&
          coverage.reduce((sum,b) => sum + cents(b.amount), 0) === cents(q.amount) &&
          coverage.reduce((sum,b) => sum + cents(b.amount_ttc), 0) === cents(q.amount_ttc)) {
        coverage.forEach(b => used.add(b.key));
        record(q, 'complete', coverage, 0, 'settled-with-advance');
        continue;
      }
      // Multiple outstanding quotes, deposits mixed with invoices or missing
      // dates make any additive interpretation unsafe. Keep the full amount.
      if (unresolved.length !== 1 || qs.some(other => results.get(other.key)?.status === 'ambiguous') || advances.length || clientBills.some(b => !b.date)) {
        record(q, 'ambiguous', remaining.concat(advances), q.amount, advances.length ? 'advances-to-link' : 'competing-quotes'); continue;
      }
      const sum = remaining.reduce((n, b) => n + cents(b.amount), 0);
      if (sum > 0 && sum <= cents(q.amount)) {
        remaining.forEach(b => used.add(b.key));
        record(q, sum === cents(q.amount) ? 'complete' : 'partial', remaining, (cents(q.amount) - sum) / 100);
      } else record(q, 'ambiguous', remaining, q.amount, 'excess-invoices');
    }
    // Resolving a repeated group also changes what remains for other quotes.
    // Invalidate those old proposals too, while leaving unrelated clients'
    // fingerprints compatible with the previous matching rules.
    if (qs.some(q => results.get(q.key).groupMatch)) {
      for (const q of qs) {
        const row = results.get(q.key);
        row.fingerprint = JSON.stringify([row.fingerprint, 'collective-elimination-v1', row.status,
          row.proposed, row.matched.map(b => b.key)]);
      }
    }
  }
  // Cross-ID evidence is a suggestion only: never merge client identities or
  // turn equal TTC into an automatic HT allocation.
  const allocated = new Set([...results.values()].flatMap(r => r.matched.map(b => b.key)));
  for (const row of results.values()) {
    if (!['unmatched', 'partial'].includes(row.status) || !row.client_id || !normalizedName(row.client) ||
        !validDate(row.date) || !Number.isFinite(row.amount_ttc) || row.amount_ttc <= 0) continue;
    const probableInvoices = bills.filter(b => b.type === 'Facture' && isConfirmed(b) && !b.duplicate &&
      !allocated.has(b.key) && b.activity === row.activity && b.client_id && b.client_id !== row.client_id &&
      normalizedName(b.client) === normalizedName(row.client) && validDate(b.date) && b.date >= row.date &&
      Number.isFinite(b.amount) && b.amount > 0 && Number.isFinite(b.amount_ttc) &&
      cents(b.amount_ttc) === cents(row.amount_ttc)).sort((a,b) => a.key.localeCompare(b.key));
    if (!probableInvoices.length) continue;
    row.probableInvoices = probableInvoices;
    row.billingRisk = true;
    row.status = 'ambiguous';
    row.reason = 'same-name-ttc';
    row.fingerprint = JSON.stringify([row.fingerprint, 'same-name-ttc-v1',
      probableInvoices.map(b => [b.key, b.client_id, b.amount, b.amount_ttc, b.date, b.state])]);
  }
  return quotes.map(q => results.get(q.key));
}

// Keep the conservative candidate pass separate from billing interpretation.
export function matchQuotes(documents = []) {
  return classifyBilling(documents, matchQuoteCandidates(documents));
}

// Agreement takes priority over the administrative state. Only a numbered,
// validated/printed quote is inferred to have been sent to the client.
export function quoteSituation(row) {
  if (row.accepted) return 'confirmed';
  const state = normalizedName(row.state);
  if (state === 'attente valid.') return 'validation';
  if (state === 'validé & imp.' && row.number?.trim()) return 'waiting';
  return null;
}

export function forecastStatus(row) {
  if (row.missing || row.review) return 'À vérifier';
  if (row.choice?.action === 'exclude' && row.choice.billed) return 'Entièrement facturé';
  if (row.choice?.action === 'include') {
    if (row.choice.remaining === 0) return 'Entièrement facturé';
    if (row.choice.situation === 'waiting') return 'En attente client';
    if (row.choice.situation === 'validation') return 'En attente de validation';
    return row.matched?.some(d => d.type !== "Facture d'acompte") ? 'Confirmé · Partiellement facturé' : 'Confirmé · À facturer';
  }
  if (['ambiguous', 'no-id'].includes(row.status)) return 'À vérifier';
  if (row.status === 'complete') return 'Entièrement facturé';
  if (!row.accepted) return quoteSituation(row) === 'waiting' ? 'En attente client' : quoteSituation(row) === 'validation' ? 'En attente de validation' : 'À vérifier';
  return row.status === 'partial' ? 'Confirmé · Partiellement facturé' : 'Confirmé · À facturer';
}

export const REASON_LABELS = {
  'scope-adjustment': 'Facture ordinaire inférieure au devis : reste candidat à examiner',
  'deposit-only': 'Acompte encaissé séparé du CA restant à facturer',
  'progress-remainder': 'Devis moins situations confirmées, indépendamment du règlement',
  'ttc-covered': 'Prix TTC entièrement facturé malgré la différence HT',
  'billed-at-least-quote': 'Facturation couvrant le devis, supplément éventuel conservé',
  'unique-exact-document-group': 'Ensemble unique couvrant le devis en HT et TTC',
  'cancelled-and-replaced-invoice': 'Facture annulée intégralement puis remplacée',
  'remaining-invoice-covers-quote': 'Facture restante après attribution des autres pièces',
  'unconfirmed-billing': 'État de facturation non confirmé',
  'ttc-excess': 'Reste HT positif mais TTC facturé supérieur au devis',
  'same-name-ttc': 'Facture probable : même nom et même TTC, ID client différent',
  'settled-with-advance': 'Couverture complète probable : facture et acomptes',
  'client-conflict': 'Nom associé à plusieurs clients', 'client-missing': 'Client non identifiable',
  'duplicate-document': 'Document présent plusieurs fois', 'credit-history': 'Avoir dans l’historique client',
  'invalid-invoice': 'Facture incomplète ou incohérente', 'quote-date': 'Date du devis manquante ou invalide',
  'quote-amount': 'Montant du devis inexploitable', 'repeated-amounts': 'Plusieurs devis de même montant, couverture non établie',
  'multiple-exact-invoices': 'Plusieurs factures du même montant', 'advances-to-link': 'Acomptes à rattacher',
  'competing-quotes': 'Plusieurs devis pour les factures restantes', 'excess-invoices': 'Factures supérieures au montant du devis',
};

export const MATCH_LABELS = {
  complete: 'Correspondance complète probable', partial: 'Facturation partielle possible',
  unmatched: 'Aucune correspondance trouvée', ambiguous: 'Rapprochement ambigu', 'no-id': 'Client non identifiable',
};

export function reconcileForecast(documents, choices) {
  const rows = matchQuotes(documents);
  const byKey = new Map(rows.map(r => [r.key, r]));
  const manualClaims = new Map();
  for (const [key, choice] of choices) {
    if (!choice.billed) continue;
    for (const bill of choice.billingKeys || []) {
      if (!manualClaims.has(bill)) manualClaims.set(bill, new Set());
      manualClaims.get(bill).add(key);
    }
  }
  const allocationConflict = row => (choices.get(row.key)?.billingKeys || []).some(key =>
    manualClaims.get(key)?.size > 1 || rows.some(other => other.key !== row.key && ['complete', 'partial'].includes(other.status) &&
      [...other.matched, ...(other.evidence || [])].some(d => d.key === key)));

  const result = rows.map(row => {
    const manual = choices.get(row.key);
    const situation = quoteSituation(row);
    const auto = !manual && !!situation && ['unmatched', 'partial'].includes(row.status) && row.proposed > 0;
    const choice = manual || (auto ? { action: 'include', situation,
      remaining: row.proposed, fingerprint: row.fingerprint, quote: row } : undefined);
    return { ...row, choice, auto, missing: false,
      review: !!choice && (choice.fingerprint !== row.fingerprint || allocationConflict(row)),
      allocationConflict: allocationConflict(row) };
  });
  for (const [key, choice] of choices) {
    if (!byKey.has(key) && choice.action === 'include') {
      result.push({ ...choice.quote, key, choice, missing: true, review: true, eligible: false });
    }
  }
  // Legacy month values remain in storage but no longer classify or schedule work.
  return result.map(row => row.choice?.action === 'include'
    ? { ...row, choice: { ...row.choice, month: null } } : row);
}

export function forecastSummary(rows, data, goal) {
  const included = rows.filter(r => r.choice?.action === 'include');
  const active = included.filter(r => !r.missing && !r.review);
  const sum = (list) => money(list.reduce((total, r) => total + r.choice.remaining, 0));
  const confirmed = active.filter(r => r.choice.situation === 'confirmed');
  const waiting = active.filter(r => r.choice.situation === 'waiting');
  const validation = active.filter(r => r.choice.situation === 'validation');
  const snap = data.snapshot.current;
  const year = String(snap.year);
  const source = data.years[year];
  const months = source.months_present || [];
  const lastMonth = months.length ? Math.max(...months) : 0;
  const cutoff = lastMonth ? `${year}-${String(lastMonth).padStart(2, '0')}` : null;
  const actual = lastMonth && isPeriodCovered(source, lastMonth) && hasObservedValue(source.monthly.ca, 1, lastMonth)
    ? money(source.monthly.ca.slice(0, lastMonth).reduce((n, v) => n + (v ?? 0), 0)) : null;
  // A uniform scenario, not invoice due dates. Never project onto RES actuals.
  // Cumulative cent rounding conserves the full amount, including thirds.
  const annualConfirmed = actual !== null && lastMonth < 12 ? sum(confirmed) : 0;
  const actualPlusConfirmed = actual === null ? null : money(actual + annualConfirmed);
  const monthly = Array(12).fill(null);
  if (actual !== null && lastMonth < 12 && annualConfirmed > 0) {
    const count = 12 - lastMonth;
    for (let i = 0; i < count; i++) {
      monthly[lastMonth + i] = (Math.round(cents(annualConfirmed) * (i + 1) / count) - Math.round(cents(annualConfirmed) * i / count)) / 100;
    }
  }
  return { year, cutoff, active, included, confirmed: sum(confirmed), waiting: sum(waiting), validation: sum(validation),
    reviewCount: included.filter(r => r.review).length,
    actual, annualConfirmed, actualPlusConfirmed, monthly,
    gap: actualPlusConfirmed !== null && Number.isFinite(goal) ? money(goal - actualPlusConfirmed) : null,
    // These invoices are displayed as an informational bridge only. Adding
    // their total to RES or selections without explicit links risks duplicates.
    unintegrated: (data.revenue_distribution?.documents || []).filter(d => ['Facture', 'Facture de situation', 'Avoir'].includes(d.type) &&
      !/brouillon/i.test(d.state) && d.date?.slice(0, 4) === year && d.date.slice(0, 7) > cutoff),
  };
}

// Compare all confirmed work with the remaining annual need, independently of RES coverage.
export function forecastCoverage(summary, goal) {
  if (!Number.isFinite(goal) || !Number.isFinite(summary.actual)) return null;
  const need = Math.max(0, money(goal - summary.actual));
  const confirmed = money(summary.confirmed);
  const balance = money(need - confirmed);
  return { need, confirmed, balance, percent: need > 0 ? Math.max(0, Math.min(100, confirmed / need * 100)) : 100 };
}
