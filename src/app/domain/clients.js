// Shared identity resolution for quotes, receivables and advances.
export const normalizedName = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR');
const idKey = (activity, id) => JSON.stringify([activity, 'id', id]);

export function clientGroups(documents) {
  const names = new Map();
  const nameKey = d => JSON.stringify([d.activity, normalizedName(d.client)]);
  for (const d of documents) {
    if (!normalizedName(d.client)) continue;
    const key = nameKey(d);
    if (!names.has(key)) names.set(key, new Set());
    if (d.client_id) names.get(key).add(d.client_id);
  }
  const blocked = new Set();
  const conflicts = new Map();
  // An unidentified document shared by several IDs cannot safely be assigned
  // to any of them, nor ignored when matching their other documents.
  for (const d of documents) {
    const ids = names.get(nameKey(d));
    if (!d.client_id && ids?.size > 1) {
      for (const key of [null, ...[...ids].map(id => idKey(d.activity, id))]) {
        if (key !== null) blocked.add(key);
        if (!conflicts.has(key)) conflicts.set(key, new Set());
        for (const related of documents.filter(other => nameKey(other) === nameKey(d))) {
          conflicts.get(key).add(related);
        }
      }
    }
  }
  return {
    blocked,
    conflicts,
    resolve(d) {
      if (d.client_id) return idKey(d.activity, d.client_id);
      const name = normalizedName(d.client), ids = names.get(nameKey(d));
      if (!name || ids?.size > 1) return null;
      return ids?.size === 1 ? idKey(d.activity, [...ids][0]) : JSON.stringify([d.activity, 'name', name]);
    },
    ambiguous(d) { return !d.client_id && names.get(nameKey(d))?.size > 1; },
  };
}
