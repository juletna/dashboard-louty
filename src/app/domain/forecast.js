import { isPeriodCovered, hasObservedValue } from './schema.js';

const cents = (value) => Math.round(value * 100);
const money = (value) => Math.round(value * 100) / 100;
export const validMonth = (value) => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const groupKey = (d) => d.client_id ? JSON.stringify([d.activity, d.client_id]) : null;
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

// A match is a proposal, never a statement of settlement. Missing client IDs
// never fall back to a name. Invoice allocations are unique across quotes.
export function matchQuotes(documents = []) {
  const quotes = documents.filter(d => d.type === 'Devis' && !/brouillon/i.test(d.state));
  const bills = documents.filter(d => billingTypes.has(d.type) && !/brouillon/i.test(d.state));
  const groups = new Map();
  for (const q of quotes) {
    const key = groupKey(q);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  const results = new Map();
  for (const [key, qs] of groups) {
    const clientBills = key === null ? [] : bills.filter(b => groupKey(b) === key);
    const available = clientBills.filter(b => b.amount > 0 && !b.duplicate && b.type !== "Facture d'acompte");
    const used = new Set();
    const candidates = (q) => available.filter(b => !used.has(b.key) && q.date && b.date && b.date >= q.date);
    const risky = clientBills.some(b => b.type === 'Avoir' || !Number.isFinite(b.amount) || b.amount < 0 || b.duplicate || !b.date);
    const record = (q, status, matched = [], proposed = q.amount) => {
      results.set(q.key, { ...q, status, eligible: status !== 'complete', matched, proposed,
        // Any change in this client's documents asks for review, including a
        // disappeared invoice or another quote competing for its allocation.
        fingerprint: JSON.stringify([q.key, q.title, q.client, q.amount, q.date,
          ...[qs, clientBills].map(part => [...part].sort((a, b) => a.key.localeCompare(b.key))
            .map(d => [d.key, d.amount, d.date, d.duplicate]))]) });
    };
    for (const q of qs) {
      if (key === null) record(q, 'no-id');
      else if (q.duplicate || risky || !q.date || !Number.isFinite(q.amount) || q.amount <= 0) record(q, 'ambiguous');
    }
    // Unique exact matches first. An identical amount on two quotes is kept
    // ambiguous regardless of file order, rather than allocating arbitrarily.
    for (const q of qs.filter(q => !results.has(q.key))) {
      const exact = candidates(q).filter(b => cents(b.amount) === cents(q.amount));
      const competitors = qs.filter(other => cents(other.amount) === cents(q.amount));
      if (exact.length === 1 && competitors.length === 1) {
        used.add(exact[0].key); record(q, 'complete', exact, 0);
      } else if (exact.length) record(q, 'ambiguous');
    }
    const unresolved = qs.filter(q => !results.has(q.key));
    for (const q of unresolved) {
      const remaining = candidates(q);
      const advances = clientBills.filter(b => b.type === "Facture d'acompte" && b.amount > 0 && q.date && b.date >= q.date);
      if (!remaining.length && !advances.length) { record(q, 'unmatched'); continue; }
      // Multiple outstanding quotes, deposits mixed with invoices or missing
      // dates make any additive interpretation unsafe. Keep the full amount.
      if (unresolved.length !== 1 || qs.some(other => results.get(other.key)?.status === 'ambiguous') || advances.length || clientBills.some(b => !b.date)) {
        record(q, 'ambiguous', remaining.concat(advances)); continue;
      }
      const sum = remaining.reduce((n, b) => n + cents(b.amount), 0);
      if (sum > 0 && sum <= cents(q.amount)) {
        remaining.forEach(b => used.add(b.key));
        record(q, sum === cents(q.amount) ? 'complete' : 'partial', remaining, (cents(q.amount) - sum) / 100);
      } else record(q, 'ambiguous', remaining);
    }
  }
  return quotes.map(q => results.get(q.key));
}

export const MATCH_LABELS = {
  complete: 'Correspondance complète probable', partial: 'Facturation partielle possible',
  unmatched: 'Aucune correspondance trouvée', ambiguous: 'Rapprochement ambigu', 'no-id': 'ID client absent',
};

export function reconcileForecast(documents, choices) {
  const rows = matchQuotes(documents);
  const byKey = new Map(rows.map(r => [r.key, r]));
  const result = rows.map(row => {
    const choice = choices.get(row.key);
    return { ...row, choice, missing: false,
      review: !!choice && choice.fingerprint !== row.fingerprint };
  });
  for (const [key, choice] of choices) {
    if (!byKey.has(key) && choice.action === 'include') {
      result.push({ ...choice.quote, key, choice, missing: true, review: true, eligible: false });
    }
  }
  return result;
}

export function forecastSummary(rows, data, goal) {
  const included = rows.filter(r => r.choice?.action === 'include');
  const active = included.filter(r => !r.missing && !r.review);
  const sum = (list) => money(list.reduce((total, r) => total + r.choice.remaining, 0));
  const confirmed = active.filter(r => r.choice.situation === 'confirmed');
  const waiting = active.filter(r => r.choice.situation === 'waiting');
  const snap = data.snapshot.current;
  const year = String(snap.year);
  const source = data.years[year];
  const months = source.months_present || [];
  const lastMonth = months.length ? Math.max(...months) : 0;
  const cutoff = lastMonth ? `${year}-${String(lastMonth).padStart(2, '0')}` : null;
  const dated = confirmed.filter(r => r.choice.month?.startsWith(year + '-') && r.choice.month > cutoff);
  // RES month is treated conservatively as covered in full; pending amounts
  // assigned to that month remain visible but never stack onto its actuals.
  const actual = lastMonth && isPeriodCovered(source, lastMonth) && hasObservedValue(source.monthly.ca, 1, lastMonth)
    ? money(source.monthly.ca.slice(0, lastMonth).reduce((n, v) => n + (v ?? 0), 0)) : null;
  const annualConfirmed = sum(dated);
  const actualPlusConfirmed = actual === null ? null : money(actual + annualConfirmed);
  const monthly = Array(12).fill(null);
  for (const row of dated) {
    const i = Number(row.choice.month.slice(5)) - 1;
    monthly[i] = money((monthly[i] ?? 0) + row.choice.remaining);
  }
  return { year, cutoff, active, included, confirmed: sum(confirmed), waiting: sum(waiting),
    undated: sum(active.filter(r => !r.choice.month)), reviewCount: included.filter(r => r.review).length,
    actual, annualConfirmed, actualPlusConfirmed, monthly,
    gap: actualPlusConfirmed !== null && Number.isFinite(goal) ? money(goal - actualPlusConfirmed) : null,
    coveredCount: active.filter(r => r.choice.month && cutoff && r.choice.month <= cutoff).length,
    // These invoices are displayed as an informational bridge only. Adding
    // their total to RES or selections without explicit links risks duplicates.
    unintegrated: (data.revenue_distribution?.documents || []).filter(d => ['Facture', 'Facture de situation', 'Avoir'].includes(d.type) &&
      !/brouillon/i.test(d.state) && d.date?.slice(0, 4) === year && d.date.slice(0, 7) > cutoff),
  };
}
