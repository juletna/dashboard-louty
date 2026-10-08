import { matchQuotes } from '../domain/forecast.js';
import { openAdvances } from '../domain/forecast-advances.js';

export function customerModalRows(items, kind) {
  return items.map(item => {
    const docs = item.documents || [];
    const due = kind === 'receivables' ? docs.map(d => d.due_date).filter(Boolean).sort()[0] : null;
    return { label: `${item.client}${item.client_id ? ' · client ' + item.client_id : ''}${item.activity ? ' · ' + item.activity : ''} · ${due ? 'Échéance ' + due.slice(0,10) : docs.length + (kind === 'receivables' ? ' facture(s)' : ' acompte(s) encaissé(s)')}${item.identity_ambiguous ? ' · identité à vérifier' : ''}`, amount: item.amount };
  });
}

export function renderCustomerAdvances(sante, details, { money, escape: esc, documents, open: precomputed }) {
  const clients = details?.advances || [];
  const total = clients.reduce((sum, c) => sum + c.amount, 0);
  const historyCount = clients.reduce((n, c) => n + (c.documents || []).length, 0);
  const known = sante && sante.acompte_ca_accounts_present === true && Number.isFinite(sante.acomptes_en_ca);
  const hasPieces = Array.isArray(documents) && documents.length > 0;
  const open = precomputed || (hasPieces ? openAdvances(matchQuotes(documents)) : []);
  const openHT = Math.round(open.reduce((n, a) => n + a.advanceHT, 0) * 100) / 100;
  const gap = known && hasPieces ? Math.round((sante.acomptes_en_ca - openHT) * 100) / 100 : null;
  const note = !sante ? 'Importe la Balance pour comparer avec les comptes d’acomptes.'
    : sante.acompte_ca_accounts_present === undefined ? 'Réimporte la Balance pour lire les comptes d’acomptes de cet ancien cache.'
    : !known ? 'Aucun compte d’acompte (7040) dans cette Balance.'
    : !hasPieces ? 'Importe les Pièces pour retrouver les devis concernés.'
    : Math.abs(gap) <= 1 ? 'La Balance et les Pièces concordent.'
    : `Écart de ${money(Math.abs(gap))} HT entre la Balance et les devis rapprochés : ${gap > 0 ? 'un acompte n’est rattaché à aucun devis' : 'un acompte rapproché est déjà repris en Balance'}.`;
  const rows = open.length ? '<ul>' + open.map(a => `<li><strong>${esc(a.client)}</strong>${a.client_id ? ' · client ' + esc(a.client_id) : ''} · devis ${esc(a.quote || 'sans numéro')} · acompte ${esc(a.numbers.join(', '))} : ${money(a.advanceHT)} HT (${money(a.advanceTTC)} TTC) · reste à facturer net d’acompte ${money(a.remainingHT)} HT</li>`).join('') + '</ul>'
    : `<p class="small">${hasPieces ? 'Aucun acompte encaissé en attente de reprise dans les Pièces.' : 'Pièces non importées.'}</p>`;
  const past = historyCount - open.reduce((n, a) => n + a.numbers.length, 0);
  const balanceText = known ? money(sante.acomptes_en_ca) : 'indisponible';
  const piecesText = hasPieces ? money(openHT) : 'non importées';
  const status = known && hasPieces ? (Math.abs(gap) <= 1 ? ' · concordent' : ' · écart à vérifier') : '';
  const history = historyCount ? `<details><summary>Historique des acomptes encaissés (${historyCount})</summary><p class="small">${past > 0 ? past + ' déjà repris ou non rattaché(s) à un devis ouvert. ' : ''}Total encaissé dans les Pièces : ${money(total)} TTC.</p><ul>${clients.flatMap(c => (c.documents || []).map(d => `<li><strong>${esc(c.client)}</strong>${c.client_id ? ' · client ' + esc(c.client_id) : ''} · ${esc(d.number || 'Sans numéro')} · ${esc(d.date?.slice(0,10) || 'Date absente')} : ${money(d.amount)} TTC${d.duplicate ? ' · doublon à vérifier' : ''}${c.identity_ambiguous ? ' · identité à vérifier' : ''}</li>`)).join('')}</ul></details>` : '';
  return `<section class="customer-advances" aria-label="Acomptes clients"><details><summary>Rapprochement des acomptes · Balance ${balanceText} · Pièces ${piecesText}${status}</summary><p class="small">Un acompte facturé est déjà compté dans le CA réalisé. Il reste à reprendre sur la facture finale, qui sera donc du montant du devis moins l’acompte. Montants HT. ${esc(note)}</p>${rows}${hasPieces ? history : ''}</details></section>`;
}
