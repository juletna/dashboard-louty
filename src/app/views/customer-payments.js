export function customerModalRows(items, kind) {
  return items.map(item => {
    const docs = item.documents || [];
    const due = kind === 'receivables' ? docs.map(d => d.due_date).filter(Boolean).sort()[0] : null;
    return { label: `${item.client}${item.client_id ? ' · client ' + item.client_id : ''}${item.activity ? ' · ' + item.activity : ''} · ${due ? 'Échéance ' + due.slice(0,10) : docs.length + (kind === 'receivables' ? ' facture(s)' : ' acompte(s) encaissé(s)')}${item.identity_ambiguous ? ' · identité à vérifier' : ''}`, amount: item.amount };
  });
}
