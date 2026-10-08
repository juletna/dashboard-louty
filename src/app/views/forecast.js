import { FORECAST_STATES, quickForecastChoice } from '../domain/forecast-actions.js';
import { renderForecastSummary, renderQuotesPanel } from './forecast-summary.js';
import { reconcileForecast, forecastSummary, forecastStatus, quoteSituation, MATCH_LABELS, REASON_LABELS } from '../domain/forecast.js';
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
  const quotes = document.getElementById('forecast-quotes');
  const el = id => document.getElementById(id);
  let data, goal, rows = [], summary, editingKey = null, returnFocus, quotesOpener;
  let situationFilter = '', dashboardSearch = '', dashboardTab = 'confirmed';
  const situationOf = r => forecastStatus(r) === 'Entièrement facturé' ? 'complete' : forecastStatus(r) === 'À vérifier' ? 'review' : r.choice?.action === 'include' ? (r.choice.remaining === 0 ? 'complete' : r.choice.situation) : r.status === 'complete' ? 'complete' : quoteSituation(r) || 'review';
  const selected = r => r.choice?.action === 'include';
  const candidate = r => !r.missing && !selected(r) && r.eligible && r.choice?.action !== 'exclude';
  const reviewRows = () => rows.filter(r => candidate(r) || (selected(r) && (r.review || r.missing || r.choice.reviewRequested)));
  // A saved amount predating the deposit deduction would double count the deposit: show the current proposal.
  const reviewValue = r => (r.advanceDeductedHT > 0 && Number.isFinite(r.proposed) ? [r.proposed] : [r.choice?.remaining, r.proposed, r.amount]).find(Number.isFinite);
  const displayStatus = r => forecastStatus(r).replace('Confirmé · À facturer', 'À facturer (estimation)').replace('Confirmé · Partiellement facturé', 'À facturer (estimation) · Partiellement facturé');
  const dashboardRows = kind => kind === 'review' ? reviewRows() : rows.filter(r => selected(r) && !r.review && !r.missing && !r.choice.reviewRequested && r.choice.situation === kind && r.choice.remaining > 0);
  const matchingLabel = r => r.groupMatch ? 'Couverture complète probable du groupe de devis' : r.nameConflict ? 'Nom associé à plusieurs ID · à vérifier' : `${REASON_LABELS[r.reason] || MATCH_LABELS[r.status]}${r.matchBasis === 'name' ? ' · par nom client' : ''}`;
  const describe = r => r.missing ? 'Absent de cet export · à vérifier' : r.review && selected(r) ? 'Rapprochement modifié · à vérifier' :
    r.choice?.reviewRequested ? 'Mis à examiner manuellement · hors totaux' : r.choice?.action === 'exclude' ? 'Écarté manuellement' : matchingLabel(r);
  function recalculate() {
    rows = reconcileForecast(data.revenue_distribution?.documents || [], storage.choices);
    summary = forecastSummary(rows, data, goal);
    data.forecast = summary;
  }
  function renderSummary() {
    const hasDocuments = Array.isArray(data.revenue_distribution?.documents);
    const legacyPieces = hasDocuments && data.revenue_distribution.documents.some(d => !Object.hasOwn(d, 'agreement_date'));
    const warning = (legacyPieces ? '<p class="forecast-warning">Réimporte les Pièces pour lire les dates d’accord, montants TTC et règlements nécessaires aux nouveaux rapprochements.</p>' : '') + (storage.warning ? `<p class="forecast-warning" role="alert">${esc(storage.warning)}</p>` : '');
    if (!hasDocuments) {
      if (quotes.open) quotes.close();
      host.innerHTML = `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires prévisionnel</h2></div><button class="btn" data-f-action="import">Importer les Pièces</button></div><p class="small">Ajoute un export Pièces incluant tous les devis, même non facturés. Les brouillons sont exclus automatiquement.</p>${warning}${summary.included.length ? '<p class="forecast-warning">Tes choix sont conservés. Réimporte les Pièces pour les rapprocher et réactiver le prévisionnel.</p>' : ''}`;
      return;
    }
    const review = reviewRows();
    host.innerHTML = renderForecastSummary({ summary, goal, reviewCount: review.length,
      reviewAmount: review.reduce((n,r) => n + (reviewValue(r) ?? 0), 0), reviewUnknown: review.filter(r => !Number.isFinite(reviewValue(r))).length,
      counts: quoteCounts(), warning, money: formatMoney, escape: esc });
    renderQuotes();
  }
  const quoteCounts = () => Object.fromEntries(['confirmed','waiting','validation','review'].map(k => [k,dashboardRows(k).length]));
  function renderQuotes() {
    el('forecast-quotes-body').innerHTML = renderQuotesPanel({ counts: quoteCounts(), activeTab: dashboardTab,
      search: dashboardSearch, tables: dashboardTable(dashboardTab), escape: esc });
  }
  // Opens the quotes modal on a tab; every entry point (cards, warning, button) goes through here.
  function openQuotes(tab, opener) {
    dashboardTab = tab || dashboardTab; dashboardSearch = '';
    quotesOpener = opener;
    renderQuotes();
    if (!quotes.open) quotes.showModal();
    el('forecast-tab-' + dashboardTab).focus();
  }
  function dashboardTable(situation) {
    const label = { confirmed:'À facturer (estimation)', waiting:'En attente client', validation:'En attente de validation', review:'À examiner' }[situation];
    const list = dashboardRows(situation)
      .filter(r => `${r.client} ${r.number} ${r.title}`.toLocaleLowerCase('fr').includes(dashboardSearch.toLocaleLowerCase('fr')))
      .sort((a,b) => a.client.localeCompare(b.client) || String(a.number).localeCompare(String(b.number)));
    const review = situation === 'review';
    const total = list.reduce((n,r) => n + (review ? reviewValue(r) ?? 0 : r.choice.remaining),0);
    return `<section aria-label="Devis ${esc(label.toLocaleLowerCase('fr'))}"><div class="forecast-table-head"><span class="small">${review ? 'À vérifier · hors totaux' : situation === 'confirmed' ? 'Reste à facturer estimé' : 'Hors estimation'}</span><strong>${review ? 'Montants à vérifier' : money(total)}</strong></div><div class="forecast-table-scroll"><table><thead><tr><th scope="col">Client / devis</th><th scope="col" class="forecast-table-amount">Devis HT</th><th scope="col" class="forecast-table-amount">Acompte repris HT</th><th scope="col" class="forecast-table-amount">${review ? 'CA prévisionnel indicatif HT' : situation === 'confirmed' ? 'CA prévisionnel retenu HT' : 'Reste HT · hors estimation'}</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${list.map(r => {
      const value = review ? reviewValue(r) : r.choice.remaining;
      return `<tr><td><strong>${esc(r.client || 'Client non renseigné')}</strong><small>${esc(r.number || 'Sans numéro')} · ${esc(r.title || '')}</small>${review ? `<small>${esc(describe(r))}${!Number.isFinite(r.choice?.remaining) && !Number.isFinite(r.proposed) && Number.isFinite(r.amount) ? ' · Montant total du devis, reste à déterminer' : ''}</small>` : ''}</td><td class="forecast-table-amount">${Number.isFinite(r.amount) ? formatMoney(r.amount) : '—'}</td><td class="forecast-table-amount">${r.advanceDeductedHT > 0 ? '− ' + formatMoney(r.advanceDeductedHT) : '—'}</td><td class="forecast-table-amount">${Number.isFinite(value) ? formatMoney(value) : 'À déterminer'}${Number.isFinite(r.amount) && r.advanceDeductedHT > 0 ? `<small class="forecast-mobile-note">devis ${formatMoney(r.amount)} − acompte ${formatMoney(r.advanceDeductedHT)}</small>` : ''}${(r.billedHT ?? 0) - (r.advanceDeductedHT || 0) > 0.005 && r.status === 'partial' ? `<small>après ${formatMoney(r.billedHT - (r.advanceDeductedHT || 0))} déjà facturé</small>` : ''}</td><td><div class="forecast-table-actions"><div class="forecast-row-menu"><button type="button" class="forecast-link forecast-actions-toggle" data-f-menu aria-expanded="false" aria-controls="forecast-actions-${rows.indexOf(r)}" aria-label="Actions pour ${esc(r.client)} · ${esc(r.number)}">Actions</button><div class="forecast-row-menu-items" id="forecast-actions-${rows.indexOf(r)}">${Object.entries({...FORECAST_STATES, exclude:'Exclure'}).filter(([target]) => target !== situation).map(([target,text]) => `<button type="button" data-f-transition="${rows.indexOf(r)}" data-f-target="${target}" ${r.missing && target !== 'exclude' ? 'disabled title="Devis absent : réimporte les Pièces avant de le reclasser"' : ''}>${text}</button>`).join('')}</div></div>${r.missing ? '' : `<button class="forecast-link" data-f-edit="${rows.indexOf(r)}" aria-label="${review ? 'Vérifier' : 'Voir le détail de'} ${esc(r.client)} · ${esc(r.number)}">${review ? 'Vérifier le devis' : 'Voir le détail'} →</button>`}</div></td></tr>`;
    }).join('') || '<tr><td colspan="5" class="small">Aucun devis</td></tr>'}</tbody></table></div></section>`;
  }
  function renderList() {
    const yearSelect = el('forecast-year'), previousYear = yearSelect.value;
    yearSelect.innerHTML = '<option value="">Toutes les années</option>' + [...new Set(rows.map(r => r.date?.slice(0,4)).filter(Boolean))].sort().reverse().map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join('');
    yearSelect.value = previousYear;
    const text = el('forecast-search').value.toLocaleLowerCase('fr');
    const contextual = rows.filter(r => !r.missing)
      .filter(r => !yearSelect.value || r.date?.startsWith(yearSelect.value))
      .filter(r => `${r.client} ${r.number} ${r.title}`.toLocaleLowerCase('fr').includes(text));
    manager.querySelectorAll('[data-f-situation]').forEach(button => {
      const value = button.dataset.fSituation;
      const count = contextual.filter(r => !value || situationOf(r) === value).length;
      button.textContent = (value ? ({waiting:'En attente client',validation:'En attente de validation',confirmed:'À facturer (estimation)',complete:'Entièrement facturés',review:'À vérifier'})[value] : 'Toutes les situations') + ' · ' + count;
      button.setAttribute('aria-pressed', String(value === situationFilter));
    });
    const filtered = contextual.filter(r => !situationFilter || situationOf(r) === situationFilter);
    el('forecast-filter').textContent = 'Ajout manuel possible, même si une facturation complète semble correspondre.';
    el('forecast-list').innerHTML = filtered.length ? filtered.map(r => {
      const index = rows.indexOf(r);
      return `<article class="forecast-row"><div><strong>${esc(r.client || 'Client non renseigné')}</strong><p class="small">${esc(r.number || 'Sans numéro')} · ${esc(r.date || 'Date absente')}</p><p class="small">${esc(r.title)}</p></div><div class="forecast-row-amount">${r.choice?.billed && !r.review ? money(0) : selected(r) ? money(r.choice.remaining) : Number.isFinite(r.proposed) ? money(r.proposed) : 'À déterminer'}<small>${r.advanceDeductedHT > 0 ? 'reste à facturer net d’acompte' : 'restant à facturer'}</small></div><div><span class="forecast-situation ${situationOf(r)}">${esc(displayStatus(r))}</span><span class="forecast-badge ${r.review || ['ambiguous', 'no-id'].includes(r.status) ? 'warn' : ''}">${esc(describe(r))}</span>${r.accepted ? `<p class="small">Accord du ${esc(r.agreement_date)}${r.auto ? ' · ajout automatique' : ''}</p>` : ''}</div><div class="forecast-row-actions">${!r.missing ? `<button class="btn" data-f-edit="${index}">${selected(r) ? r.review ? 'Vérifier' : 'Modifier' : 'Ajouter'}</button>` : ''}${selected(r) ? `<button class="forecast-link" data-f-remove="${index}">Retirer</button>` : ''}</div></article>`;
    }).join('') : '<p class="forecast-empty">Aucun devis dans cette vue.</p>';
    el('forecast-storage-message').textContent = storage.warning;
  }
  function openManager(situation = null) {
    if (situation !== null) situationFilter = situation;
    else if (!manager.open) situationFilter = '';
    el('forecast-year').value = '';
    el('forecast-search').value = ''; el('forecast-message').textContent = '';
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
    el('forecast-situation').value = row.choice?.reviewRequested ? 'review' : row.choice?.situation || quoteSituation(row) || 'confirmed';
    el('forecast-amount').value = selected(row) && !(row.review && row.advanceDeductedHT > 0 && Number.isFinite(row.proposed)) ? row.choice.remaining : row.candidateRemaining ?? row.proposed ?? '';
    el('forecast-note').textContent = row.choice?.reviewRequested && !row.review ? 'Ce devis a été mis à examiner manuellement et reste hors totaux jusqu’à son reclassement.' : row.review ? 'Le rapprochement a changé. Ton montant saisi a été conservé. Vérifie-le avant de réactiver cette prévision.' : row.status === 'complete' ? 'Une correspondance complète est probable. Saisis le montant restant si tu souhaites ajouter ce devis manuellement.' : 'Vérifie le montant restant et la situation réelle du chantier avant de confirmer.';
    el('forecast-evidence').innerHTML = `<p>${esc(matchingLabel(row))}. ${row.status === 'no-id' ? 'ID et nom client exploitables absents.' : 'Les montants rapprochés ne prouvent pas le rattachement au devis.'}</p>${row.groupMatch ? '<p>Les factures couvrent collectivement les devis de même montant. La pièce affichée est une attribution indicative, pas un lien établi.</p>' : ''}${row.duplicate ? '<p>Plusieurs pièces portent cette même identité. Elles sont regroupées ici et demandent une vérification.</p>' : ''}<ul>${(row.evidence?.length ? row.evidence : row.matched || []).map(b => `<li>${esc(b.type)} ${esc(b.number)} · ${esc(b.date || 'date absente')} : ${exactMoney(b.amount)} HT · ${exactMoney(b.amount_ttc)} TTC · client ${esc(b.client_id || 'ID absent')}</li>`).join('')}</ul>${row.candidateRemaining !== null && Number.isFinite(row.candidateRemaining) ? `<p>Reste candidat : ${exactMoney(row.candidateRemaining)} HT · hors totaux, décision nécessaire.</p>` : ''}${row.advanceDeductedHT > 0 ? `<p>Reste net d’acompte : devis ${exactMoney(row.amount)} HT − acompte à reprendre ${exactMoney(row.advanceDeductedHT)} HT (déjà dans le CA réalisé). Ton logiciel affiche encore le reste brut tant que l’acompte n’est pas repris.</p>` : ''}${Number.isFinite(row.remainingTTC) ? `<p>Reste TTC : ${exactMoney(row.remainingTTC)}.</p>` : ''}${Number.isFinite(row.differenceHT) ? `<p>Facturation − devis : ${exactMoney(row.differenceHT)} HT${Number.isFinite(row.differenceTTC) ? ' · ' + exactMoney(row.differenceTTC) + ' TTC' : ''}.</p>` : ''}${row.warning ? `<p>${esc(row.warning)}.</p>` : ''}<p>Entièrement facturé ne signifie pas payé.</p>`;
    el('forecast-evidence').closest('details').open = false;
    el('forecast-probable-invoices').innerHTML = row.probableInvoices?.length ? `<div class="forecast-warning"><strong>Facturation complète à confirmer</strong><p>Devis : ${exactMoney(row.amount)} HT · ${exactMoney(row.amount_ttc)} TTC · client ${esc(row.client_id)}.</p><ul>${row.probableInvoices.map(b => `<li>Facture ${esc(b.number)} · ${esc(b.date)} · ${esc(b.client)} · client ${esc(b.client_id)} : ${exactMoney(b.amount)} HT · ${exactMoney(b.amount_ttc)} TTC.</li>`).join('')}</ul><p>Les ID clients diffèrent. Le même TTC peut masquer un changement de TVA. Vérifie que ce chantier est entièrement facturé. La confirmation retire ce devis du prévisionnel et reste mémorisée aux prochains imports.</p><button type="button" class="btn" data-f-action="confirm-billed">Confirmer : chantier entièrement facturé</button></div>` : '';
    const history = (data.revenue_distribution?.documents || []).filter(d => d.activity === row.activity &&
      ((row.client_id && d.client_id === row.client_id) || (normalizedName(row.client) && normalizedName(d.client) === normalizedName(row.client))))
      .sort((a,b) => (b.date || '').localeCompare(a.date || '') || String(a.number).localeCompare(String(b.number)));
    const ttc = value => Number.isFinite(value) ? exactMoney(value) + ' TTC' : 'Non renseigné';
    el('forecast-history').innerHTML = `<details class="forecast-method" ${row.status === 'ambiguous' ? 'open' : ''}><summary>Historique du client et correspondances possibles · ${history.length} pièces</summary><p>Même activité et même ID client, ou même nom complet (majuscules et espaces ignorés). Un nom identique ne prouve pas qu’il s’agit du même client. Les brouillons sont exclus de l’import.</p><div class="forecast-history-scroll" role="region" aria-label="Historique des pièces du client" tabindex="0"><table class="forecast-history-table"><thead><tr><th>Pièce / date</th><th>Client / ID</th><th>Titre</th><th>État / accord</th><th>Montant HT</th><th>Montant TTC</th><th>Déjà réglé TTC</th><th>En attente TTC</th></tr></thead><tbody>${history.map(d => `<tr ${d.type === row.type && d.number === row.number && d.date === row.date ? 'class="forecast-history-current"' : ''}><td>${esc(d.type)} ${esc(d.number)}<br>${esc(d.date || 'Date absente')}${d.type === row.type && d.number === row.number && d.date === row.date ? '<br><strong>Devis examiné</strong>' : ''}</td><td>${esc(d.client)}<br>${esc(d.client_id || 'ID absent')}${d.client_id && row.client_id && d.client_id !== row.client_id ? '<br><strong class="forecast-badge warn">ID différent</strong>' : ''}</td><td>${esc(d.title)}</td><td>${esc(d.state)}${d.agreement_date ? '<br>Accord : ' + esc(d.agreement_date) : ''}</td><td>${exactMoney(d.amount)} HT</td><td>${ttc(d.amount_ttc)}</td><td>${ttc(d.paid)}</td><td>${ttc(d.pending)}</td></tr>`).join('')}</tbody></table></div><p>« En attente » indique le reste à encaisser sur une pièce, pas le reste du chantier à facturer. Les montants de cet historique ne sont pas additionnés au prévisionnel.</p></details>`;
    renderAdvances(row);
    el('forecast-form-error').textContent = '';
    el('forecast-remove-editor').hidden = !selected(row);
    editor.showModal();
  }
  quotes.addEventListener('input', e => {
    if (e.target.id !== 'forecast-dashboard-search') return;
    dashboardSearch = e.target.value;
    el('forecast-dashboard-tables').innerHTML = dashboardTable(dashboardTab);
  });
  const onDashboardClick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('sp-help')) return;
    if (b.dataset.fJump) { openQuotes(b.dataset.fJump, b); return; }
    if (b.dataset.fFilter) {
      dashboardTab = b.dataset.fFilter; dashboardSearch = '';
      renderQuotes(); el('forecast-tab-' + dashboardTab).focus();
      return;
    }
    if (b.dataset.fAction === 'quotes') { openQuotes(dashboardTab, b); return; }
    if (b.dataset.fAction === 'close-quotes') { quotes.close(); return; }
    if (b.hasAttribute('data-f-menu')) {
      b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
      return;
    }
    if (b.dataset.fTransition !== undefined) {
      const row = rows[Number(b.dataset.fTransition)], target = b.dataset.fTarget;
      if (!row || ![...Object.keys(FORECAST_STATES), 'exclude'].includes(target)) return;
      const choice = quickForecastChoice(row, target);
      if (!choice) {
        if (!row.missing) {
          returnFocus = b;
          openEditor(Number(b.dataset.fTransition));
          el('forecast-situation').value = target;
        }
        return;
      }
      commit(row, choice, 'Situation du devis mise à jour.');
      el('forecast-quick-message').textContent = `${row.client || 'Devis'} · ${row.number || 'Sans numéro'} : ${target === 'exclude' ? 'exclu du prévisionnel' : FORECAST_STATES[target]}.${storage.warning ? ' Modification appliquée pour cette session uniquement.' : ''}`;
      el('forecast-tab-' + dashboardTab).focus();
      return;
    }
    if (b.dataset.fEdit !== undefined) { returnFocus = b; openEditor(Number(b.dataset.fEdit)); return; }
    if (b.dataset.fAction === 'import') el('forecast-input').click();
    else if (b.dataset.fAction === 'manage') openManager();
  };
  host.addEventListener('click', onDashboardClick);
  quotes.addEventListener('click', onDashboardClick);
  quotes.addEventListener('keydown', e => {
    if (!e.target.matches('[role=tab]') || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault();
    const tabs = ['confirmed','waiting','validation','review'];
    const index = tabs.indexOf(dashboardTab);
    dashboardTab = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (index + (e.key === 'ArrowRight' ? 1 : 3)) % 4];
    dashboardSearch = ''; renderQuotes(); el('forecast-tab-' + dashboardTab).focus();
  });
  manager.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fSituation !== undefined) { situationFilter = b.dataset.fSituation; renderList(); }
    if (b.dataset.fEdit !== undefined) openEditor(Number(b.dataset.fEdit));
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
      const reserved = new Set(rows.filter(r => r.key !== row.key && r.choice?.billed).flatMap(r => r.choice.billingKeys || []));
      if (row.probableInvoices.some(d => reserved.has(d.key))) {
        el('forecast-form-error').textContent = 'Une facture proposée est déjà rattachée par une décision manuelle. Vérifie les devis concernés.';
        return;
      }
      commit(row, { action: 'exclude', billed: true, billingKeys: row.probableInvoices.map(d => d.key), fingerprint: row.fingerprint, quote: quoteSnapshot(row) }, 'Chantier confirmé entièrement facturé. Devis retiré du prévisionnel.');
      editor.close();
    }
  });
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
      remaining: Math.round(remaining * 100) / 100,
      reviewRequested: el('forecast-situation').value === 'review',
      situation: el('forecast-situation').value === 'review' ? row.choice?.situation || quoteSituation(row) || 'confirmed' : el('forecast-situation').value }, 'Prévision enregistrée.');
    editor.close();
  });
  manager.addEventListener('close', () => {
    const target = returnFocus?.isConnected ? returnFocus : host.querySelector('[data-f-action="manage"]');
    target?.focus();
  });
  quotes.addEventListener('close', () => {
    (quotesOpener?.isConnected ? quotesOpener : host.querySelector('[data-f-action="quotes"]') || host.querySelector('[data-f-action="manage"]'))?.focus();
  });
  editor.addEventListener('close', () => { if (manager.open) el('forecast-search').focus(); else (returnFocus?.isConnected ? returnFocus : quotes.open ? el('forecast-tab-' + dashboardTab) : host.querySelector('[data-f-action="quotes"]') || host.querySelector('[data-f-action="manage"]'))?.focus(); });
  return {
    render(nextData, nextGoal) {
      if (data && data !== nextData && editor.open) editor.close();
      data = nextData; goal = nextGoal; recalculate(); renderSummary();
      if (manager.open) renderList();
    },
  };
}
