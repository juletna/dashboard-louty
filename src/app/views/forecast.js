import { renderForecastSummary } from './forecast-summary.js';
import { reconcileForecast, forecastSummary, forecastCalendar, MATCH_LABELS, REASON_LABELS } from '../domain/forecast.js';
import { normalizedName } from '../domain/clients.js';
import { forecastAdvances } from '../domain/forecast-advances.js';
import { createForecastStorage } from '../state/forecast.js';

export function createForecastView({ money: formatMoney, escape: esc, onChange }) {
  const exactMoney = value => Number.isFinite(value) ? value.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €' : 'Non renseigné';
  const money = value => `${formatMoney(value)} HT`;
  const storage = createForecastStorage({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
  const host = document.getElementById('revenue-forecast');
  const manager = document.getElementById('forecast-manager');
  const editor = document.getElementById('forecast-editor');
  const el = id => document.getElementById(id);
  let data, goal, rows = [], summary, tab = 'review', monthFilter = '', editingKey = null, returnFocus;
  let situationFilter = '', dashboardMonth = '', dashboardSearch = '';
  const situationOf = r => r.choice?.action === 'include' ? (r.choice.remaining === 0 ? 'complete' : r.choice.situation) : r.status === 'complete' ? 'complete' : r.accepted ? 'confirmed' : 'waiting';
  const situationLabels = { waiting: 'En attente client', confirmed: 'Chantier confirmé', complete: 'Facturation complète probable' };
  const selected = r => r.choice?.action === 'include';
  const candidate = r => !r.missing && !selected(r) && r.eligible && r.choice?.action !== 'exclude';
  const monthName = m => m ? new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Sans date prévue';
  const matchingLabel = r => r.groupMatch ? 'Couverture complète probable du groupe de devis' : r.nameConflict ? 'Nom associé à plusieurs ID · à vérifier' : `${REASON_LABELS[r.reason] || MATCH_LABELS[r.status]}${r.matchBasis === 'name' ? ' · par nom client' : ''}`;
  const describe = r => r.missing ? 'Absent de cet export · à vérifier' : r.review && selected(r) ? 'Rapprochement modifié · à vérifier' :
    r.choice?.action === 'exclude' ? 'Écarté manuellement' : matchingLabel(r);
  function recalculate() {
    rows = reconcileForecast(data.revenue_distribution?.documents || [], storage.choices);
    summary = forecastSummary(rows, data, goal);
    data.forecast = summary;
  }
  function renderSummary(expand = false) {
    const expanded = expand || !!el('forecast-followed')?.open;
    const hasDocuments = Array.isArray(data.revenue_distribution?.documents);
    const legacyPieces = hasDocuments && data.revenue_distribution.documents.some(d => !Object.hasOwn(d, 'agreement_date'));
    const warning = (legacyPieces ? '<p class="forecast-warning">Réimporte les Pièces pour lire les dates d’accord, montants TTC et règlements nécessaires aux nouveaux rapprochements.</p>' : '') + (storage.warning ? `<p class="forecast-warning" role="alert">${esc(storage.warning)}</p>` : '');
    if (!hasDocuments) {
      host.innerHTML = `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires prévisionnel</h2></div><button class="btn" data-f-action="import">Importer les Pièces</button></div><p class="small">Ajoute un export Pièces incluant tous les devis, même non facturés. Les brouillons sont exclus automatiquement.</p>${warning}${summary.included.length ? '<p class="forecast-warning">Tes choix sont conservés. Réimporte les Pièces pour les rapprocher et réactiver le prévisionnel.</p>' : ''}`;
      return;
    }
    if (dashboardMonth && dashboardMonth !== 'none' && !forecastCalendar(summary.active).some(v => v.month === dashboardMonth)) dashboardMonth = '';
    host.innerHTML = renderForecastSummary({ summary, goal, reviewCount: rows.filter(candidate).length,
      warning, expanded, search: dashboardSearch, tables: dashboardTable('confirmed') + dashboardTable('waiting'),
      money: formatMoney, escape: esc });
  }
  function dashboardTable(situation) {
    const list = rows.filter(r => selected(r) && r.choice.situation === situation &&
      (situation === 'waiting' || !dashboardMonth || (r.choice.month || 'none') === dashboardMonth))
      .filter(r => `${r.client} ${r.number} ${r.title}`.toLocaleLowerCase('fr').includes(dashboardSearch.toLocaleLowerCase('fr')))
      .sort((a,b) => (a.choice.month || '9999').localeCompare(b.choice.month || '9999') || a.client.localeCompare(b.client));
    const total = list.filter(r => !r.review && !r.missing).reduce((n,r) => n + r.choice.remaining,0);
    return `<section aria-label="${situation === 'confirmed' ? 'Devis confirmés' : 'Devis en attente'}"><div class="forecast-table-head"><h3>${situation === 'confirmed' ? 'Confirmés' : 'En attente client'} <span class="small">· ${list.length}</span></h3><strong>${money(total)}</strong></div><div class="forecast-table-note small">${situation === 'waiting' ? 'Sans date · hors graphique' : dashboardMonth ? esc(monthName(dashboardMonth === 'none' ? null : dashboardMonth)) : 'Reste à facturer'}${situation === 'confirmed' && dashboardMonth ? '<button class="forecast-link" data-f-action="reset-month">Tout afficher</button>' : ''}</div><div class="forecast-table-scroll"><table><thead><tr><th>Client</th>${situation === 'confirmed' ? '<th>Mois</th>' : ''}<th>HT</th><th><span class="sr-only">Action</span></th></tr></thead><tbody>${list.map(r => `<tr><td>${esc(r.client || 'Client non renseigné')}${r.review || r.missing ? '<small>À vérifier · hors totaux</small>' : ''}</td>${situation === 'confirmed' ? `<td>${r.choice.month ? esc(new Date(r.choice.month + '-01T12:00:00').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})) : 'À dater'}</td>` : ''}<td class="forecast-table-amount">${formatMoney(r.choice.remaining)}</td><td><button class="forecast-link" ${r.missing ? 'data-f-action="selected"' : `data-f-edit="${rows.indexOf(r)}"`} aria-label="${r.review || r.missing ? 'Vérifier' : 'Modifier'} ${esc(r.client)} · ${esc(r.number)}">${r.review || r.missing ? 'Vérifier' : 'Modifier'}</button></td></tr>`).join('') || `<tr><td colspan="4" class="small">Aucun devis</td></tr>`}</tbody></table></div></section>`;
  }
  function syncMonthInput() {
    const waiting = el('forecast-situation').value === 'waiting';
    el('forecast-month-field').hidden = waiting;
    el('forecast-waiting-note').hidden = !waiting;
    el('forecast-month').disabled = waiting;
    if (waiting) el('forecast-month').value = '';
  }
  function renderList() {
    const yearSelect = el('forecast-year'), previousYear = yearSelect.value;
    yearSelect.innerHTML = '<option value="">Toutes les années</option>' + [...new Set(rows.map(r => r.date?.slice(0,4)).filter(Boolean))].sort().reverse().map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('');
    yearSelect.value = previousYear;
    const text = el('forecast-search').value.toLocaleLowerCase('fr');
    const counts = { review: rows.filter(candidate).length, selected: rows.filter(selected).length, all: rows.filter(r => !r.missing).length };
    manager.querySelectorAll('[data-f-tab]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.fTab === tab));
      b.textContent = ({ review: 'À examiner', selected: 'Dans le prévisionnel', all: 'Tous les devis' })[b.dataset.fTab] + ' · ' + counts[b.dataset.fTab];
    });
    const contextual = rows.filter(r => tab === 'review' ? candidate(r) : tab === 'selected' ? selected(r) : !r.missing)
      .filter(r => !yearSelect.value || r.date?.startsWith(yearSelect.value))
      .filter(r => !monthFilter || (r.choice?.month || 'none') === monthFilter)
      .filter(r => `${r.client} ${r.number} ${r.title}`.toLocaleLowerCase('fr').includes(text));
    manager.querySelectorAll('[data-f-situation]').forEach(button => {
      const value = button.dataset.fSituation;
      const count = contextual.filter(r => !value || situationOf(r) === value).length;
      button.textContent = (value ? ({waiting:'En attente client',confirmed:'Chantiers confirmés',complete:'Facturés probables'})[value] : 'Toutes les situations') + ' · ' + count;
      button.setAttribute('aria-pressed', String(value === situationFilter));
    });
    const filtered = contextual.filter(r => !situationFilter || situationOf(r) === situationFilter);
    el('forecast-filter').textContent = monthFilter ? `Filtre : ${monthName(monthFilter === 'none' ? null : monthFilter)}. Cliquer sur un onglet pour effacer.` : tab === 'all' ? 'Ajout manuel possible, même si une facturation complète semble correspondre.' : 'Brouillons exclus · rapprochements indicatifs';
    el('forecast-list').innerHTML = filtered.length ? filtered.map(r => {
      const index = rows.indexOf(r);
      return `<article class="forecast-row"><div><strong>${esc(r.client || 'Client non renseigné')}</strong><p class="small">${esc(r.number || 'Sans numéro')} · ${esc(r.date || 'Date absente')}</p><p class="small">${esc(r.title)}</p></div><div class="forecast-row-amount">${money(tab === 'selected' ? r.choice.remaining : r.amount)}<small>${tab === 'selected' ? 'restant à facturer' : 'montant du devis'}</small></div><div><span class="forecast-situation ${situationOf(r)}">${situationLabels[situationOf(r)]}</span><span class="forecast-badge ${r.review || ['ambiguous', 'no-id'].includes(r.status) ? 'warn' : ''}">${esc(describe(r))}</span>${r.accepted ? `<p class="small">Accord du ${esc(r.agreement_date)}${r.auto ? ' · ajout automatique' : ''}</p>` : ''}${selected(r) ? `<p class="small">${esc(monthName(r.choice.month))}</p>` : ''}</div><div class="forecast-row-actions">${!r.missing ? `<button class="btn" data-f-edit="${index}">${selected(r) ? r.review ? 'Vérifier' : 'Modifier' : 'Ajouter'}</button>` : ''}${selected(r) ? `<button class="forecast-link" data-f-remove="${index}">Retirer</button>` : tab === 'review' ? `<button class="forecast-link" data-f-exclude="${index}">Écarter</button>` : ''}</div></article>`;
    }).join('') : '<p class="forecast-empty">Aucun devis dans cette vue.</p>';
    el('forecast-storage-message').textContent = storage.warning;
  }
  function openManager(nextTab = 'review', filter = '', situation = null) {
    if (situation !== null) situationFilter = situation;
    else if (!manager.open) situationFilter = '';
    el('forecast-year').value = '';
    tab = nextTab; monthFilter = filter; el('forecast-search').value = ''; el('forecast-message').textContent = '';
    renderList();
    if (!manager.open) { returnFocus = document.activeElement; manager.showModal(); }
  }
  function quoteSnapshot(row) {
    return { client: row.client, number: row.number, date: row.date, amount: row.amount, title: row.title, activity: row.activity };
  }
  function commit(row, choice, message) {
    const persisted = storage.set(row.key, choice);
    recalculate(); renderSummary(); renderList(); onChange(summary);
    el('forecast-message').textContent = persisted ? message : 'Modification appliquée pour cette session uniquement.';
  }
  function selectedAdvanceKeys(row) {
    return [...el('forecast-advances').querySelectorAll('input[data-advance-key]:checked')].map(input => input.dataset.advanceKey);
  }
  function renderAdvanceBalance(row, keys) {
    const state = forecastAdvances(row, rows, keys);
    el('forecast-advance-balance').textContent = state.error || `Acomptes rattachés : ${formatMoney(state.paid)} TTC. Solde du devis à encaisser : ${state.cash === null ? 'à vérifier (factures, avoirs ou TTC manquant)' : formatMoney(state.cash) + ' TTC'}.`;
  }
  function renderAdvances(row) {
    const state = forecastAdvances(row, rows);
    const keys = row.choice?.advanceKeys || [];
    el('forecast-advances').innerHTML = `<div class="forecast-method"><strong>Montant du chantier : ${money(row.amount)}${Number.isFinite(row.amount_ttc) ? ' · ' + formatMoney(row.amount_ttc) + ' TTC' : ''}</strong><p>Rattache uniquement les acomptes encaissés de ce chantier. Ils réduisent le solde à encaisser, pas le CA HT prévisionnel. Si une facture finale existe, son solde doit être vérifié séparément.</p>${state.candidates.length ? state.candidates.map(d => `<label class="forecast-advance-option"><input type="checkbox" data-advance-key="${esc(d.key)}" ${keys.includes(d.key) ? 'checked' : ''} ${!keys.includes(d.key) && (state.reserved.has(d.key) || d.duplicate || !Number.isFinite(d.paid) || d.paid <= 0) ? 'disabled' : ''}><span>${esc(d.number || 'Acompte sans numéro')} · ${esc(d.date || 'date absente')} · ${formatMoney(d.paid)} TTC encaissés${state.reserved.has(d.key) ? ' · déjà rattaché' : ''}${d.duplicate ? ' · pièce dupliquée' : ''}</span></label>`).join('') : '<p>Aucun acompte encaissé identifiable à rattacher.</p>'}${keys.some(key => !state.candidates.some(d => d.key === key)) ? '<p class="forecast-warning">Un ancien rattachement est absent de cet export. Enregistrer supprimera ce lien ; vérifie les pièces avant de confirmer.</p>' : ''}<p id="forecast-advance-balance" class="small"></p></div>`;
    renderAdvanceBalance(row, keys);
  }
  function openEditor(index) {
    const row = rows[index]; if (!row || row.missing) return;
    editingKey = row.key;
    el('forecast-editor-title').textContent = selected(row) ? 'Modifier la prévision' : 'Ajouter au prévisionnel';
    el('forecast-editor-subtitle').textContent = `${row.client} · ${row.number || 'Sans numéro'} · ${money(row.amount)}`;
    el('forecast-situation').value = row.choice?.situation || 'confirmed';
    el('forecast-amount').value = selected(row) ? row.choice.remaining : row.proposed ?? '';
    el('forecast-month').value = row.choice?.month || '';
    el('forecast-note').textContent = row.review ? 'Le rapprochement a changé. Ton montant saisi a été conservé. Vérifie-le avant de réactiver cette prévision.' : row.status === 'complete' ? 'Une correspondance complète est probable. Saisis le montant restant si tu souhaites ajouter ce devis manuellement.' : 'Vérifie le montant restant et la situation réelle du chantier avant de confirmer.';
    el('forecast-evidence').innerHTML = `<p>${esc(matchingLabel(row))}. ${row.status === 'no-id' ? 'ID et nom client exploitables absents.' : 'Les montants rapprochés ne prouvent pas le rattachement au devis.'}</p>${row.groupMatch ? '<p>Les factures couvrent collectivement les devis de même montant. La pièce affichée est une attribution indicative, pas un lien établi.</p>' : ''}${row.duplicate ? '<p>Plusieurs pièces portent cette même identité. Elles sont regroupées ici et demandent une vérification.</p>' : ''}<ul>${(row.matched || []).map(b => `<li>${esc(b.type)} ${esc(b.number)} · ${esc(b.date || 'date absente')} : ${money(b.amount)}</li>`).join('')}</ul>`;
    el('forecast-evidence').closest('details').open = false;
    el('forecast-probable-invoices').innerHTML = row.probableInvoices?.length ? `<div class="forecast-warning"><strong>Facturation complète à confirmer</strong><p>Devis : ${exactMoney(row.amount)} HT · ${exactMoney(row.amount_ttc)} TTC · client ${esc(row.client_id)}.</p><ul>${row.probableInvoices.map(b => `<li>Facture ${esc(b.number)} · ${esc(b.date)} · ${esc(b.client)} · client ${esc(b.client_id)} : ${exactMoney(b.amount)} HT · ${exactMoney(b.amount_ttc)} TTC.</li>`).join('')}</ul><p>Les ID clients diffèrent. Le même TTC peut masquer un changement de TVA. Vérifie que ce chantier est entièrement facturé. La confirmation retire ce devis du prévisionnel et reste mémorisée aux prochains imports.</p><button type="button" class="btn" data-f-action="confirm-billed">Confirmer : chantier entièrement facturé</button></div>` : '';
    const history = (data.revenue_distribution?.documents || []).filter(d => d.activity === row.activity &&
      ((row.client_id && d.client_id === row.client_id) || (normalizedName(row.client) && normalizedName(d.client) === normalizedName(row.client))))
      .sort((a,b) => (b.date || '').localeCompare(a.date || '') || String(a.number).localeCompare(String(b.number)));
    const ttc = value => Number.isFinite(value) ? exactMoney(value) + ' TTC' : 'Non renseigné';
    el('forecast-history').innerHTML = `<details class="forecast-method" ${row.status === 'ambiguous' ? 'open' : ''}><summary>Historique du client et correspondances possibles · ${history.length} pièces</summary><p>Même activité et même ID client, ou même nom complet (majuscules et espaces ignorés). Un nom identique ne prouve pas qu’il s’agit du même client. Les brouillons sont exclus de l’import.</p><div class="forecast-history-scroll" role="region" aria-label="Historique des pièces du client" tabindex="0"><table class="forecast-history-table"><thead><tr><th>Pièce / date</th><th>Client / ID</th><th>Titre</th><th>État / accord</th><th>Montant HT</th><th>Montant TTC</th><th>Déjà réglé TTC</th><th>En attente TTC</th></tr></thead><tbody>${history.map(d => `<tr ${d.type === row.type && d.number === row.number && d.date === row.date ? 'class="forecast-history-current"' : ''}><td>${esc(d.type)} ${esc(d.number)}<br>${esc(d.date || 'Date absente')}${d.type === row.type && d.number === row.number && d.date === row.date ? '<br><strong>Devis examiné</strong>' : ''}</td><td>${esc(d.client)}<br>${esc(d.client_id || 'ID absent')}${d.client_id && row.client_id && d.client_id !== row.client_id ? '<br><strong class="forecast-badge warn">ID différent</strong>' : ''}</td><td>${esc(d.title)}</td><td>${esc(d.state)}${d.agreement_date ? '<br>Accord : ' + esc(d.agreement_date) : ''}</td><td>${exactMoney(d.amount)} HT</td><td>${ttc(d.amount_ttc)}</td><td>${ttc(d.paid)}</td><td>${ttc(d.pending)}</td></tr>`).join('')}</tbody></table></div><p>« En attente » indique le reste à encaisser sur une pièce, pas le reste du chantier à facturer. Les montants de cet historique ne sont pas additionnés au prévisionnel.</p></details>`;
    renderAdvances(row);
    el('forecast-form-error').textContent = '';
    syncMonthInput();
    el('forecast-remove-editor').hidden = !selected(row);
    editor.showModal();
  }
  host.addEventListener('input', e => {
    if (e.target.id !== 'forecast-dashboard-search') return;
    dashboardSearch = e.target.value;
    el('forecast-dashboard-tables').innerHTML = dashboardTable('confirmed') + dashboardTable('waiting');
  });
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('sp-help')) return;
    if (b.dataset.fFilter) {
      const kind = b.dataset.fFilter;
      openManager('selected', kind === 'undated' ? 'none' : '', kind === 'undated' ? 'confirmed' : kind);
      return;
    }
    if (b.dataset.fEdit !== undefined) { returnFocus = b; openEditor(Number(b.dataset.fEdit)); return; }
    if (b.dataset.fAction === 'reset-month') { dashboardMonth = ''; renderSummary(); return; }
    if (b.dataset.fAction === 'import') el('forecast-input').click();
    else if (b.dataset.fMonth) { dashboardMonth = b.dataset.fMonth; renderSummary(true); }
    else openManager(b.dataset.fAction === 'selected' ? 'selected' : 'review');
  });
  manager.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fSituation !== undefined) { situationFilter = b.dataset.fSituation; renderList(); }
    if (b.dataset.fTab) openManager(b.dataset.fTab);
    if (b.dataset.fEdit !== undefined) openEditor(Number(b.dataset.fEdit));
    if (b.dataset.fExclude !== undefined) {
      const row = rows[Number(b.dataset.fExclude)];
      commit(row, { action: 'exclude', fingerprint: row.fingerprint, quote: quoteSnapshot(row) }, 'Devis écarté. Il reste accessible dans « Tous les devis ».');
    }
    if (b.dataset.fRemove !== undefined) {
      const row = rows[Number(b.dataset.fRemove)];
      commit(row, { action: 'exclude', fingerprint: row.fingerprint, quote: quoteSnapshot(row) }, 'Devis retiré. Ce choix reste prioritaire sur l’ajout automatique.');
    }
    if (b.dataset.fAction === 'close-manager') manager.close();
  });
  editor.addEventListener('click', e => {
    if (e.target.closest('[data-f-action="close-editor"]')) editor.close();
    if (e.target.closest('[data-f-action="remove-editor"]')) {
      const row = rows.find(r => r.key === editingKey);
      if (row) commit(row, {action:'exclude',fingerprint:row.fingerprint,quote:quoteSnapshot(row)}, 'Devis retiré du prévisionnel.');
      editor.close();
    }
    if (e.target.closest('[data-f-action="confirm-billed"]')) {
      const row = rows.find(r => r.key === editingKey);
      if (!row || !row.probableInvoices?.length) return;
      commit(row, { action: 'exclude', fingerprint: row.fingerprint, quote: quoteSnapshot(row) }, 'Chantier confirmé entièrement facturé. Devis retiré du prévisionnel.');
      editor.close();
    }
  });
  el('forecast-situation').addEventListener('change', syncMonthInput);
  el('forecast-year').addEventListener('change', renderList);
  el('forecast-advances').addEventListener('change', () => {
    const row = rows.find(r => r.key === editingKey);
    if (row) renderAdvanceBalance(row, selectedAdvanceKeys(row));
  });
  el('forecast-search').addEventListener('input', renderList);
  el('forecast-form').addEventListener('submit', e => {
    e.preventDefault();
    const row = rows.find(r => r.key === editingKey);
    const remaining = Number(el('forecast-amount').value);
    if (!row || row.missing || !Number.isFinite(remaining) || remaining < 0 || el('forecast-amount').value === '') {
      el('forecast-form-error').textContent = 'Saisis un montant HT valide, supérieur ou égal à zéro.'; return;
    }
    const advanceKeys = selectedAdvanceKeys(row);
    const advanceState = forecastAdvances(row, rows, advanceKeys);
    if (advanceState.error) { el('forecast-form-error').textContent = advanceState.error; return; }
    commit(row, { action: 'include', advanceKeys, fingerprint: row.fingerprint, quote: quoteSnapshot(row),
      remaining: Math.round(remaining * 100) / 100, situation: el('forecast-situation').value, month: el('forecast-situation').value === 'waiting' ? null : el('forecast-month').value || null }, 'Prévision enregistrée.');
    editor.close();
  });
  manager.addEventListener('close', () => {
    const target = returnFocus?.isConnected ? returnFocus : host.querySelector('[data-f-action="manage"]');
    target?.focus();
  });
  editor.addEventListener('close', () => { if (manager.open) el('forecast-search').focus(); else host.querySelector('[data-f-action="manage"]')?.focus(); });
  return {
    render(nextData, nextGoal) {
      if (data && data !== nextData && editor.open) editor.close();
      data = nextData; goal = nextGoal; recalculate(); renderSummary();
      if (manager.open) renderList();
    },
  };
}
