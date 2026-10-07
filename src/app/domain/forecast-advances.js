// Deposit links are manual evidence only. They never reduce forecast revenue.
export function forecastAdvances(row, rows, keys = row.choice?.advanceKeys || []) {
  const candidates = row.advanceCandidates || [];
  const reserved = new Set(rows.filter(r => r.key !== row.key && r.choice?.action === 'include')
    .flatMap(r => r.choice.advanceKeys || []));
  const byKey = new Map(candidates.map(d => [d.key, d]));
  const linked = keys.map(key => byKey.get(key));
  const conflict = keys.some(key => reserved.has(key));
  const invalid = new Set(keys).size !== keys.length || linked.some(d => !d || d.duplicate || !Number.isFinite(d.paid) || d.paid <= 0);
  const paid = invalid ? null : Math.round(linked.reduce((sum, d) => sum + d.paid, 0) * 100) / 100;
  const excess = Number.isFinite(row.amount_ttc) && paid !== null && paid > row.amount_ttc + .005;
  const error = conflict ? 'Un acompte sélectionné est déjà rattaché à un autre devis.' : invalid ? 'Un acompte rattaché est absent, dupliqué ou son paiement est inconnu. Vérifie la sélection.' : excess ? 'Les acomptes sélectionnés dépassent le montant TTC du devis.' : '';
  const cash = !error && Number.isFinite(row.amount_ttc) && row.amount_ttc >= 0 &&
    !row.billingRisk && !(row.invoiceCandidates || []).length
    ? Math.round((row.amount_ttc - paid) * 100) / 100 : null;
  return { candidates, reserved, linked: linked.filter(Boolean), paid, cash, error };
}
