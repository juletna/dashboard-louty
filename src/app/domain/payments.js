import { clientGroups } from './clients.js';

const cents = value => Math.round(value * 100);
const money = value => Math.round(value * 100) / 100;

// Paid and pending balances are TTC. Unknown balances stay null on documents;
// only explicit positive balances become payment details.
export function paymentDetails(documents = []) {
  const clients = clientGroups(documents);
  const advances = new Map(), receivables = new Map();
  const add = (map, d, value, index) => {
    const resolved = clients.resolve(d);
    const key = resolved ?? JSON.stringify(['unresolved', d.key ?? index]);
    if (!map.has(key)) map.set(key, { client: d.client || 'Client non renseigné', client_id: d.client_id,
      activity: d.activity, amount: 0, documents: [], identity_ambiguous: resolved === null || clients.blocked.has(resolved) });
    const item = map.get(key);
    item.amount += cents(value);
    item.documents.push({ ...d, amount_ht: d.amount, amount: money(value) });
  };
  documents.forEach((d, index) => {
    if (/brouillon/i.test(d.state) || !/confirm/i.test(d.state)) return;
    if (d.type === "Facture d'acompte" && Number.isFinite(d.paid) && d.paid > 0) add(advances, d, d.paid, index);
    if (['Facture', 'Facture de situation'].includes(d.type) && Number.isFinite(d.pending) && d.pending > 0) add(receivables, d, d.pending, index);
  });
  const list = map => [...map.values()].map(item => ({ ...item, amount: item.amount / 100,
    documents: item.documents.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))) }))
    .sort((a, b) => b.amount - a.amount);
  return { advances: list(advances), receivables: list(receivables) };
}

// Search at document level: one client's historical deposits must not be an
// inseparable candidate. Results retain the existing client/documents shape.
// A truncated search is never evidence of a unique match.
export function advanceMatches(items, total, { maxStates = 10000, maxOperations = 100000, maxSolutions = 6 } = {}) {
  const target = Number.isFinite(total) ? cents(Math.max(0, total)) : 0;
  if (!target) return { solutions: [], truncated: false };
  const candidates = items.flatMap(item => (item.documents || []).map(document => ({
    ...item, amount: document.amount, documents: [document],
  }))).filter(item => Number.isFinite(item.amount) && cents(item.amount) > 0 && cents(item.amount) <= target && !item.documents[0].duplicate);
  const states = new Map([[0, { solutions: [[]], truncated: false }]]);
  let operations = 0, exhausted = false;
  outer: for (const item of candidates) {
    for (const [sum, state] of [...states.entries()].sort((a, b) => b[0] - a[0])) {
      if (++operations > maxOperations) { exhausted = true; break outer; }
      const next = sum + cents(item.amount);
      if (next > target) continue;
      if (!states.has(next)) {
        if (states.size >= maxStates) { exhausted = true; break outer; }
        states.set(next, { solutions: [], truncated: false });
      }
      const destination = states.get(next);
      for (const solution of state.solutions) {
        if (destination.solutions.length < maxSolutions) destination.solutions.push([...solution, item]);
        else destination.truncated = true;
      }
      destination.truncated ||= state.truncated;
    }
  }
  const found = states.get(target);
  return { solutions: found?.solutions ?? [], truncated: exhausted || (found?.truncated ?? false) };
}
