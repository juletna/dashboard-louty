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
  function renderSummary() {
    const hasDocuments = Array.isArray(data.revenue_distribution?.documents);
    const cap = el('cap-forecast');
    const legacyPieces = hasDocuments && data.revenue_distribution.documents.some(d => !Object.hasOwn(d, 'agreement_date'));
    const warning = (legacyPieces ? '<p class="forecast-warning">Réimporte les Pièces pour lire les dates d’accord, montants TTC et règlements nécessaires aux nouveaux rapprochements.</p>' : '') + (storage.warning ? `<p class="forecast-warning" role="alert">${esc(storage.warning)}</p>` : '');
    if (!hasDocuments) {
      host.innerHTML = `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires à venir</h2><p class="small">Montants HT restant à facturer</p></div><button class="btn" data-f-action="import">Importer les Pièces</button></div><p class="small">Ajoute un export Pièces incluant tous les devis, même non facturés. Les brouillons sont exclus automatiquement.</p>${warning}${summary.included.length ? '<p class="forecast-warning">Tes choix sont conservés. Réimporte les Pièces pour les rapprocher et réactiver le prévisionnel.</p>' : ''}`;
      if (cap) cap.innerHTML = '';
      return;
    }
    const confirmedCount = summary.active.filter(r => r.choice.situation === 'confirmed').length;
    const waitingCount = summary.active.filter(r => r.choice.situation === 'waiting').length;
    const monthValues = forecastCalendar(summary.active);
    if (dashboardMonth && dashboardMonth !== 'none' && !monthValues.some(v => v.month === dashboardMonth)) dashboardMonth = '';
    const max = Math.max(100, Math.ceil(Math.max(0, ...monthValues.map(v => v.confirmed)) / 1000) * 1000);
    host.innerHTML = `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires à venir</h2><p class="small">Montants HT restant à facturer · ta sélection de devis</p></div><button class="btn primary" data-f-action="manage">Gérer les devis</button></div>${warning}
      <div class="forecast-overview"><aside class="forecast-summary"><div class="forecast-kpis"><div><span>Travaux confirmés</span><strong>${money(summary.confirmed)}</strong><small>${confirmedCount} devis · reste à facturer</small></div><div><span>En attente client</span><strong>${money(summary.waiting)}</strong><small>${waitingCount} devis · sans date · hors graphique</small></div>${summary.active.some(r => r.choice.situation === 'confirmed' && !r.choice.month) ? `<div class="forecast-to-plan"><span>Dont à planifier</span><strong>${money(summary.undated)}</strong><button class="forecast-link" data-f-month="none">Planifier les devis sans date →</button></div>` : ''}</div></aside><div class="forecast-schedule">
      <div class="forecast-head"><h3>Facturation des chantiers confirmés</h3><span class="small">${monthValues.length ? esc(monthName(monthValues[0].month)) + (monthValues.length > 1 ? ' → ' + esc(monthName(monthValues.at(-1).month)) : '') + ' · HT' : ''}</span></div>
      ${monthValues.length ? `<div class="forecast-chart-scroll"><div class="forecast-chart" style="min-width:${Math.max(300, monthValues.length * 95)}px"><div class="forecast-axis">${[1,.75,.5,.25,0].map((v,i) => `<span style="top:${i*25}%">${formatMoney(max*v)}</span>`).join('')}</div><div class="forecast-columns" style="grid-template-columns:repeat(${monthValues.length},minmax(0,1fr))">${monthValues.map(v => `<button class="forecast-column" data-f-month="${esc(v.month)}" aria-pressed="${dashboardMonth === v.month}" aria-label="${esc(monthName(v.month))} : ${money(v.confirmed)} confirmés"><span class="forecast-column-bar" style="height:${v.confirmed/max*100}%"><b>${formatMoney(v.confirmed)}</b></span><span class="forecast-column-label">${esc(monthName(v.month))}</span></button>`).join('')}</div></div></div>` : '<p class="small">Aucun chantier confirmé daté. Renseigne un mois dans « Modifier » pour afficher le graphique.</p>'}
      </div></div>
      ${summary.active.some(r => r.auto) ? `<p class="small">${summary.active.filter(r => r.auto).length} devis ajouté(s) automatiquement par date d’accord. Précise leur mois de facturation pour les intégrer au cap annuel.</p>` : ''}
      ${summary.reviewCount ? `<p class="forecast-warning">${summary.reviewCount} devis sélectionné(s) à vérifier après actualisation du rapprochement. Leurs montants saisis sont conservés, mais suspendus des totaux. <button class="forecast-link" data-f-action="selected">Vérifier</button></p>` : ''}
      ${summary.coveredCount ? `<p class="small">${summary.coveredCount} devis prévu(s) sur une période déjà couverte par le RES : à replanifier. Non ajoutés au réalisé.</p>` : ''}
      <div class="forecast-table-toolbar"><h3>Devis suivis</h3><input id="forecast-dashboard-search" type="search" aria-label="Rechercher les devis suivis" placeholder="Rechercher…" value="${esc(dashboardSearch)}"></div>
      <div id="forecast-dashboard-tables" class="forecast-dashboard-tables">${dashboardTable('confirmed')}${dashboardTable('waiting')}</div>
      <div class="forecast-footer"><div><strong>${rows.filter(candidate).length} devis à examiner</strong><p class="small">Les devis acceptés sans ambiguïté sont ajoutés automatiquement. Les autres restent à examiner.</p></div><button class="btn" data-f-action="review">Examiner les propositions</button></div>
      <details class="forecast-method"><summary>Comprendre les montants et les rapprochements</summary><p>Comparaison des montants HT par activité et ID client en priorité. Sans ID, le nom complet sert de repli : seules les majuscules et les espaces sont ignorés. Un nom associé à plusieurs ID reste à vérifier. Chaque facture est utilisée au plus une fois. Les acomptes, avoirs et correspondances ambiguës demandent une vérification. Une date d’accord valide ajoute automatiquement un devis confirmé si son reste à facturer est identifiable. Les cas ambigus restent à examiner. Tes choix manuels priment sur cet automatisme.</p><p>Les montants réalisés restent inchangés. Les graphiques de pilotage ajoutent le CA confirmé et une marge estimée, au taux historique pondéré et après prise en compte des coûts déjà comptabilisés. Le résultat, le salaire et la trésorerie ne sont pas recalculés à partir de ces devis. Ce scénario reste séparé de la projection statistique.</p><p>Les choix restent sur ce navigateur. Un nouvel import ne remplace jamais un montant saisi manuellement.</p></details>`;
    if (cap) cap.innerHTML = `<div class="forecast-cap"><h3>CA réalisé + confirmé prévu · ${esc(summary.year)}</h3><div class="forecast-cap-values"><div><span>Réalisé RES</span><strong>${money(summary.actual)}</strong></div><span aria-hidden="true">+</span><div><span>Confirmé après ${esc(monthName(summary.cutoff))}</span><strong>${money(summary.annualConfirmed)}</strong></div><span aria-hidden="true">=</span><div><span>Réalisé + confirmé prévu</span><strong>${money(summary.actualPlusConfirmed)}</strong></div><div><span>${summary.gap !== null && summary.gap < 0 ? 'Au-delà de l’objectif' : 'Reste à couvrir'}</span><strong>${money(summary.gap === null ? null : Math.abs(summary.gap))}</strong></div></div><p class="small">Base partielle : seuls les devis confirmés, vérifiés et datés après les mois couverts par le RES et avant fin ${esc(summary.year)} sont ajoutés. Ne s’ajoute pas à la projection statistique.</p>${summary.unintegrated.length ? `<details class="forecast-method"><summary>${summary.unintegrated.length} facture(s) / avoir(s) datés après la période RES · ${money(summary.unintegrated.reduce((n, d) => n + (d.amount ?? 0), 0))}</summary><p>Repère à rapprocher du prochain RES. Ce montant n’est pas ajouté automatiquement : il pourrait recouper les devis sélectionnés.</p><ul>${summary.unintegrated.map(d => `<li>${esc(d.date)} · ${esc(d.number || d.type)} · ${esc(d.client)} : ${money(d.amount)}</li>`).join('')}</ul></details>` : ''}</div>`;
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
  function openManager(nextTab = 'review', filter = '') {
    if (!manager.open) situationFilter = '';
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
    if (b.dataset.fEdit !== undefined) { returnFocus = b; openEditor(Number(b.dataset.fEdit)); return; }
    if (b.dataset.fAction === 'reset-month') { dashboardMonth = ''; renderSummary(); return; }
    if (b.dataset.fAction === 'import') el('forecast-input').click();
    else if (b.dataset.fMonth) { dashboardMonth = b.dataset.fMonth; renderSummary(); }
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
