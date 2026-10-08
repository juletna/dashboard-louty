import { forecastCoverage } from '../domain/forecast.js';

// Presentation only: the underlying confirmed selections and annual scenario are unchanged.
export function renderForecastSummary({ summary, goal, reviewCount, reviewAmount, reviewUnknown, warning, expanded, search, tables, activeTab, counts, money, escape: esc }) {
  const coverage = forecastCoverage(summary, goal);
  const estimated = summary.confirmed;
  const scale = coverage ? Math.max(coverage.need, estimated) : 0;
  const covered = coverage ? Math.min(coverage.need, estimated) : 0;
  const surplus = coverage ? -coverage.balance : 0;
  const labels = { confirmed:'À facturer (estimation)', waiting:'En attente client', validation:'En attente de validation', review:'À examiner' };
  const help = 'Montants HT. Le besoin restant correspond à l’objectif annuel moins le CA réalisé. Les devis acceptés et vérifiés alimentent le montant à facturer estimé, qui reste susceptible d’ajustements. Les attentes et les devis à examiner restent hors estimation. Pour les devis à examiner, le montant saisi ou le reste candidat est affiché lorsqu’il est connu ; sinon, le montant total du devis sert de repère, sans constituer un reste à facturer validé. Les montants inconnus sont signalés. Le scénario annuel répartit l’estimation uniformément après la période RES jusqu’à décembre ; il ne constitue pas un calendrier de facturation et alimente les projections du cap annuel.';
  const potential = (kind, amount, note) => `<aside class="forecast-potential forecast-potential-${kind}" aria-label="${labels[kind]}"><h3>${labels[kind]}</h3><strong>${money(amount)} <small>HT</small></strong><div class="forecast-potential-foot"><span>${note}</span><button class="forecast-link" data-f-jump="${kind}">${counts[kind] === 1 ? 'Voir le devis' : `Voir les ${counts[kind]} devis`} →</button></div></aside>`;
  const showWaiting = summary.waiting !== 0;
  const showValidation = summary.validation !== 0;
  const showReview = reviewAmount !== 0 || reviewUnknown > 0;
  const columns = Number(showWaiting) + Number(showValidation || showReview);
  return `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires prévisionnel</h2><p class="small">Restant à facturer · exercice ${esc(summary.year)} · montants HT</p></div></div>${warning}
    <div class="forecast-future-layout" data-potential-columns="${columns}">
      <section id="cap-forecast" class="forecast-coverage" aria-label="Couverture du CA restant à produire">
        <div class="forecast-estimated"><strong>${money(estimated)}</strong> <span>HT · À facturer (estimation)</span></div>
        ${coverage ? `<p class="forecast-difference ${surplus < 0 ? 'shortfall' : ''}"><strong>${surplus > 0 ? '+' : surplus < 0 ? '−' : ''}${money(Math.abs(surplus))}</strong> HT par rapport à l’objectif, <em>selon cette estimation</em>.</p>
        <div class="forecast-scale"><div class="forecast-threshold ${surplus <= 0 ? 'at-end' : coverage.need === 0 ? 'at-start' : ''}" style="--threshold:${scale ? coverage.need / scale * 100 : 100}%"><span>Objectif</span></div>
          <div class="forecast-coverage-track ${surplus < 0 ? 'shortfall' : ''}" role="img" aria-label="${esc(money(estimated))} HT estimés pour un besoin de ${esc(money(coverage.need))} HT ; ${esc(money(Math.abs(surplus)))} HT ${surplus < 0 ? 'à trouver' : 'de dépassement estimé'}"><span style="width:${scale ? covered / scale * 100 : 0}%"></span>${surplus > 0 ? `<span class="forecast-excess" style="width:${surplus / scale * 100}%"></span>` : ''}</div>
          <div class="forecast-coverage-legend"><span><span><i></i>${surplus < 0 ? 'Besoin couvert par l’estimé' : 'Besoin couvert'}</span><strong>${money(covered)} HT</strong></span><span><span><i class="${surplus < 0 ? 'forecast-gap-dot' : 'forecast-excess-dot'}"></i>${surplus < 0 ? 'Reste à trouver' : 'Dépassement estimé'}</span><strong>${surplus > 0 ? '+' : ''}${money(Math.abs(surplus))} HT</strong></span></div>
        </div>` : '<p class="small">Besoin indisponible : un objectif et une période RES couverte sont nécessaires.</p>'}
      </section>
      ${columns ? `<div class="forecast-potentials" style="--potential-columns:${columns}">
        ${showWaiting ? potential('waiting', summary.waiting, 'Hors estimation') : ''}
        ${showValidation || showReview ? `<div class="forecast-potential-stack">
        ${showValidation ? potential('validation', summary.validation, 'Hors estimation') : ''}
        ${showReview ? `<aside class="forecast-potential forecast-review-card" aria-label="À examiner"><h3>À examiner</h3><strong>${reviewUnknown === reviewCount && reviewCount > 0 ? 'À déterminer' : money(reviewAmount) + ' <small>HT</small>'}</strong><div class="forecast-potential-foot"><span>Montants indicatifs · hors totaux${reviewUnknown ? ` · ${reviewUnknown} non renseigné(s)` : ''}</span><button class="forecast-link" data-f-jump="review">Vérifier ${reviewCount} devis →</button></div></aside>` : ''}
        </div>` : ''}
      </div>` : ''}
    </div>
    ${summary.reviewCount ? `<p class="forecast-warning">${summary.reviewCount} devis sélectionné(s) à vérifier après actualisation du rapprochement. Leurs montants saisis sont conservés, mais suspendus des totaux. <button class="forecast-link" data-f-action="selected">Vérifier</button></p>` : ''}
    <div class="forecast-details-row"><details id="forecast-followed" class="forecast-followed" ${expanded ? 'open' : ''}><summary><span class="forecast-show-label">Afficher les devis →</span><span class="forecast-hide-label">Masquer les devis ↑</span></summary>
      <div class="forecast-table-toolbar"><nav class="forecast-quick-filters" role="tablist" aria-label="Situation des devis">${Object.entries(labels).map(([kind,label]) => `<button type="button" role="tab" id="forecast-tab-${kind}" data-f-filter="${kind}" aria-controls="forecast-dashboard-tables" aria-selected="${activeTab === kind}" tabindex="${activeTab === kind ? 0 : -1}">${label} · ${counts[kind]}</button>`).join('')}</nav><input id="forecast-dashboard-search" type="search" aria-label="Rechercher dans les devis de cet onglet" placeholder="Client, numéro ou titre…" value="${esc(search)}"></div><div id="forecast-dashboard-tables" class="forecast-dashboard-tables" role="tabpanel" aria-labelledby="forecast-tab-${activeTab}">${tables}</div></details>
      <button type="button" class="forecast-link sp-help forecast-help" data-tip="${esc(help)}" aria-label="Comprendre le prévisionnel">Comprendre le calcul ⓘ</button>
    </div>
    <p id="forecast-quick-message" class="small" role="status"></p><div class="forecast-all"><button class="forecast-link" data-f-action="manage">Tous les devis / gérer les sélections</button></div>
    ${summary.unintegrated.length ? `<details class="forecast-method"><summary>${summary.unintegrated.length} facture(s) / avoir(s) après la période RES · à rapprocher</summary><p>Ces pièces ne sont pas ajoutées automatiquement : elles pourraient recouper les devis sélectionnés.</p><ul>${summary.unintegrated.map(d => `<li>${esc(d.date)} · ${esc(d.number || d.type)} · ${esc(d.client)} : ${money(d.amount)} HT</li>`).join('')}</ul></details>` : ''}`;
}
