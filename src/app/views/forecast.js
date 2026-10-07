import { reconcileForecast, forecastSummary, MATCH_LABELS } from '../domain/forecast.js';
import { createForecastStorage } from '../state/forecast.js';

export function createForecastView({ money: formatMoney, escape: esc, onChange }) {
  const money = value => `${formatMoney(value)} HT`;
  const storage = createForecastStorage({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
  const host = document.getElementById('revenue-forecast');
  const manager = document.getElementById('forecast-manager');
  const editor = document.getElementById('forecast-editor');
  const el = id => document.getElementById(id);
  let data, goal, rows = [], summary, tab = 'review', monthFilter = '', editingKey = null, returnFocus;
  const selected = r => r.choice?.action === 'include';
  const candidate = r => !r.missing && !selected(r) && r.eligible && (r.choice?.action !== 'exclude' || r.review);
  const monthName = m => m ? new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : 'Sans date prévue';
  const describe = r => r.missing ? 'Absent de cet export · à vérifier' : r.review && selected(r) ? 'Pièces modifiées · à vérifier' :
    r.choice?.action === 'exclude' && !r.review ? 'Écarté manuellement' : MATCH_LABELS[r.status];
  function recalculate() {
    rows = reconcileForecast(data.revenue_distribution?.documents || [], storage.choices);
    summary = forecastSummary(rows, data, goal);
    data.forecast = summary;
  }
  function renderSummary() {
    const hasDocuments = Array.isArray(data.revenue_distribution?.documents);
    const cap = el('cap-forecast');
    const warning = storage.warning ? `<p class="forecast-warning" role="alert">${esc(storage.warning)}</p>` : '';
    if (!hasDocuments) {
      host.innerHTML = `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires à venir</h2><p class="small">Montants HT restant à facturer</p></div><button class="btn" data-f-action="import">Importer les Pièces</button></div><p class="small">Ajoute un export Pièces incluant tous les devis, même non facturés. Les brouillons sont exclus automatiquement.</p>${warning}${summary.included.length ? '<p class="forecast-warning">Tes choix sont conservés. Réimporte les Pièces pour les rapprocher et réactiver le prévisionnel.</p>' : ''}`;
      if (cap) cap.innerHTML = '';
      return;
    }
    const confirmedCount = summary.active.filter(r => r.choice.situation === 'confirmed').length;
    const waitingCount = summary.active.filter(r => r.choice.situation === 'waiting').length;
    const baseYear = Number(summary.year);
    const nextMonth = summary.cutoff ? Number(summary.cutoff.slice(5)) + 1 : 1;
    const calendar = new Set(summary.active.map(r => r.choice.month).filter(Boolean));
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseYear, nextMonth - 1 + i, 1);
      calendar.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const months = [...calendar].sort().concat('');
    const monthValues = months.map(m => {
      const list = summary.active.filter(r => (r.choice.month || '') === m);
      const sum = situation => list.filter(r => r.choice.situation === situation).reduce((n, r) => n + r.choice.remaining, 0);
      return { month: m, confirmed: sum('confirmed'), waiting: sum('waiting') };
    });
    const max = Math.max(1, ...monthValues.flatMap(v => [v.confirmed, v.waiting]));
    host.innerHTML = `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires à venir</h2><p class="small">Montants HT restant à facturer · ta sélection de devis</p></div><button class="btn primary" data-f-action="manage">Gérer les devis</button></div>${warning}
      <div class="forecast-kpis"><div><span>Travaux confirmés</span><strong>${money(summary.confirmed)}</strong><small>${confirmedCount} devis · reste à facturer</small></div><div><span>En attente client</span><strong>${money(summary.waiting)}</strong><small>${waitingCount} devis · potentiel non acquis</small></div><div><span>Dont sans date prévue</span><strong>${money(summary.undated)}</strong><small>À positionner dans le temps</small></div></div>
      ${summary.reviewCount ? `<p class="forecast-warning">${summary.reviewCount} devis sélectionné(s) à vérifier après import. Leurs montants saisis sont conservés, mais suspendus des totaux. <button class="forecast-link" data-f-action="selected">Vérifier</button></p>` : ''}
      ${summary.coveredCount ? `<p class="small">${summary.coveredCount} devis prévu(s) sur une période déjà couverte par le RES : à replanifier. Non ajoutés au réalisé.</p>` : ''}
      <h3>Facturation prévue</h3><div class="forecast-legend"><span><i></i>Travaux confirmés</span><span><i class="waiting"></i>En attente client</span></div>
      <div class="forecast-months">${monthValues.map(v => `<button class="forecast-month" data-f-month="${esc(v.month || 'none')}" aria-label="${esc(monthName(v.month))} : ${money(v.confirmed)} confirmés, ${money(v.waiting)} en attente"><span>${esc(monthName(v.month))}</span><div class="forecast-bars" aria-hidden="true"><i style="height:${v.confirmed / max * 64}px"></i><i class="waiting" style="height:${v.waiting / max * 64}px"></i></div><strong>${money(v.confirmed)}</strong><small>+ ${money(v.waiting)} en attente</small></button>`).join('')}</div>
      <div class="forecast-footer"><div><strong>${rows.filter(candidate).length} devis à examiner</strong><p class="small">Le rapprochement propose, tu choisis ce qui entre au prévisionnel.</p></div><button class="btn" data-f-action="review">Examiner les propositions</button></div>
      <details class="forecast-method"><summary>Comprendre les montants et les rapprochements</summary><p>Comparaison des montants HT par ID client et activité. Chaque facture est utilisée au plus une fois. Les acomptes, avoirs et correspondances ambiguës demandent une vérification. Les statuts d’accord Louty ne décident pas de ta sélection.</p><p>La marge brute, le résultat, le salaire et la trésorerie ne sont pas recalculés à partir de ces devis. Les montants confirmés sont séparés de la projection statistique.</p><p>Les choix restent sur ce navigateur. Un nouvel import ne remplace jamais un montant saisi manuellement.</p></details>`;
    if (cap) cap.innerHTML = `<div class="forecast-cap"><h3>CA réalisé + confirmé prévu · ${esc(summary.year)}</h3><div class="forecast-cap-values"><div><span>Réalisé RES</span><strong>${money(summary.actual)}</strong></div><span aria-hidden="true">+</span><div><span>Confirmé après ${esc(monthName(summary.cutoff))}</span><strong>${money(summary.annualConfirmed)}</strong></div><span aria-hidden="true">=</span><div><span>Réalisé + confirmé prévu</span><strong>${money(summary.actualPlusConfirmed)}</strong></div><div><span>${summary.gap !== null && summary.gap < 0 ? 'Au-delà de l’objectif' : 'Reste à couvrir'}</span><strong>${money(summary.gap === null ? null : Math.abs(summary.gap))}</strong></div></div><p class="small">Base partielle : seuls les devis confirmés, vérifiés et datés après les mois couverts par le RES et avant fin ${esc(summary.year)} sont ajoutés. Ne s’ajoute pas à la projection statistique.</p>${summary.unintegrated.length ? `<details class="forecast-method"><summary>${summary.unintegrated.length} facture(s) / avoir(s) datés après la période RES · ${money(summary.unintegrated.reduce((n, d) => n + (d.amount ?? 0), 0))}</summary><p>Repère à rapprocher du prochain RES. Ce montant n’est pas ajouté automatiquement : il pourrait recouper les devis sélectionnés.</p><ul>${summary.unintegrated.map(d => `<li>${esc(d.date)} · ${esc(d.number || d.type)} · ${esc(d.client)} : ${money(d.amount)}</li>`).join('')}</ul></details>` : ''}</div>`;
  }
  function renderList() {
    const text = el('forecast-search').value.toLocaleLowerCase('fr');
    const counts = { review: rows.filter(candidate).length, selected: rows.filter(selected).length, all: rows.filter(r => !r.missing).length };
    manager.querySelectorAll('[data-f-tab]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.fTab === tab));
      b.textContent = ({ review: 'À examiner', selected: 'Dans le prévisionnel', all: 'Tous les devis' })[b.dataset.fTab] + ' · ' + counts[b.dataset.fTab];
    });
    const filtered = rows.filter(r => tab === 'review' ? candidate(r) : tab === 'selected' ? selected(r) : !r.missing)
      .filter(r => !monthFilter || (r.choice?.month || 'none') === monthFilter)
      .filter(r => `${r.client} ${r.number} ${r.title}`.toLocaleLowerCase('fr').includes(text));
    el('forecast-filter').textContent = monthFilter ? `Filtre : ${monthName(monthFilter === 'none' ? null : monthFilter)}. Cliquer sur un onglet pour effacer.` : tab === 'all' ? 'Ajout manuel possible, même si une facturation complète semble correspondre.' : 'Brouillons exclus · rapprochements indicatifs';
    el('forecast-list').innerHTML = filtered.length ? filtered.map(r => {
      const index = rows.indexOf(r);
      return `<article class="forecast-row"><div><strong>${esc(r.client || 'Client non renseigné')}</strong><p class="small">${esc(r.number || 'Sans numéro')} · ${esc(r.date || 'Date absente')}</p><p class="small">${esc(r.title)}</p></div><div class="forecast-row-amount">${money(tab === 'selected' ? r.choice.remaining : r.amount)}<small>${tab === 'selected' ? 'restant à facturer' : 'montant du devis'}</small></div><div><span class="forecast-badge ${r.review || ['ambiguous', 'no-id'].includes(r.status) ? 'warn' : ''}">${esc(describe(r))}</span>${selected(r) ? `<p class="small">${r.choice.situation === 'confirmed' ? 'Travaux confirmés' : 'En attente client'} · ${esc(monthName(r.choice.month))}</p>` : ''}</div><div class="forecast-row-actions">${!r.missing ? `<button class="btn" data-f-edit="${index}">${selected(r) ? r.review ? 'Vérifier' : 'Modifier' : 'Ajouter'}</button>` : ''}${selected(r) ? `<button class="forecast-link" data-f-remove="${index}">Retirer</button>` : tab === 'review' ? `<button class="forecast-link" data-f-exclude="${index}">Écarter</button>` : ''}</div></article>`;
    }).join('') : '<p class="forecast-empty">Aucun devis dans cette vue.</p>';
    el('forecast-storage-message').textContent = storage.warning;
  }
  function openManager(nextTab = 'review', filter = '') {
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
  function openEditor(index) {
    const row = rows[index]; if (!row || row.missing) return;
    editingKey = row.key;
    el('forecast-editor-title').textContent = selected(row) ? 'Modifier la prévision' : 'Ajouter au prévisionnel';
    el('forecast-editor-subtitle').textContent = `${row.client} · ${row.number || 'Sans numéro'} · ${money(row.amount)}`;
    el('forecast-situation').value = row.choice?.situation || 'confirmed';
    el('forecast-amount').value = selected(row) ? row.choice.remaining : row.proposed ?? '';
    el('forecast-month').value = row.choice?.month || '';
    el('forecast-note').textContent = row.review ? 'Les pièces ont changé. Ton montant saisi a été conservé. Vérifie-le avant de réactiver cette prévision.' : row.status === 'complete' ? 'Une correspondance complète est probable. Saisis le montant restant si tu souhaites ajouter ce devis manuellement.' : 'Vérifie le montant restant et la situation réelle du chantier avant de confirmer.';
    el('forecast-evidence').innerHTML = `<p>${esc(MATCH_LABELS[row.status])}. ${row.status === 'no-id' ? 'Aucun rapprochement automatique sans ID client.' : 'Les montants rapprochés ne prouvent pas le rattachement au devis.'}</p>${row.duplicate ? '<p>Plusieurs pièces portent cette même identité. Elles sont regroupées ici et demandent une vérification.</p>' : ''}<ul>${(row.matched || []).map(b => `<li>${esc(b.type)} ${esc(b.number)} · ${esc(b.date || 'date absente')} : ${money(b.amount)}</li>`).join('')}</ul>`;
    el('forecast-evidence').closest('details').open = false;
    el('forecast-form-error').textContent = '';
    editor.showModal();
  }
  host.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fAction === 'import') el('forecast-input').click();
    else if (b.dataset.fMonth) openManager('selected', b.dataset.fMonth);
    else openManager(b.dataset.fAction === 'selected' ? 'selected' : 'review');
  });
  manager.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.fTab) openManager(b.dataset.fTab);
    if (b.dataset.fEdit !== undefined) openEditor(Number(b.dataset.fEdit));
    if (b.dataset.fExclude !== undefined) {
      const row = rows[Number(b.dataset.fExclude)];
      commit(row, { action: 'exclude', fingerprint: row.fingerprint, quote: quoteSnapshot(row) }, 'Devis écarté. Il reste accessible dans « Tous les devis ».');
    }
    if (b.dataset.fRemove !== undefined) commit(rows[Number(b.dataset.fRemove)], null, 'Devis retiré du prévisionnel.');
    if (b.dataset.fAction === 'close-manager') manager.close();
  });
  editor.addEventListener('click', e => { if (e.target.closest('[data-f-action="close-editor"]')) editor.close(); });
  el('forecast-search').addEventListener('input', renderList);
  el('forecast-form').addEventListener('submit', e => {
    e.preventDefault();
    const row = rows.find(r => r.key === editingKey);
    const remaining = Number(el('forecast-amount').value);
    if (!row || row.missing || !Number.isFinite(remaining) || remaining < 0 || el('forecast-amount').value === '') {
      el('forecast-form-error').textContent = 'Saisis un montant HT valide, supérieur ou égal à zéro.'; return;
    }
    commit(row, { action: 'include', fingerprint: row.fingerprint, quote: quoteSnapshot(row),
      remaining: Math.round(remaining * 100) / 100, situation: el('forecast-situation').value, month: el('forecast-month').value || null }, 'Prévision enregistrée.');
    editor.close();
  });
  manager.addEventListener('close', () => {
    const target = returnFocus?.isConnected ? returnFocus : host.querySelector('[data-f-action="manage"]');
    target?.focus();
  });
  editor.addEventListener('close', () => el('forecast-search').focus());
  return {
    render(nextData, nextGoal) {
      if (data && data !== nextData && editor.open) editor.close();
      data = nextData; goal = nextGoal; recalculate(); renderSummary();
      if (manager.open) renderList();
    },
  };
}
