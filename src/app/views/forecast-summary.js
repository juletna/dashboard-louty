import { forecastCoverage } from '../domain/forecast.js';

// Presentation only: the underlying confirmed selections and annual scenario are unchanged.
export const FORECAST_TAB_LABELS = { confirmed:'À facturer (estimation)', waiting:'En attente client', validation:'En attente de validation', review:'À examiner' };

// Tabs, search and table of the quotes modal; the summary only keeps the entry button.
export function renderQuotesPanel({ search, tables, activeTab, counts, escape: esc }) {
  return `<div class="forecast-table-toolbar"><nav class="forecast-quick-filters" role="tablist" aria-label="Situation des devis">${Object.entries(FORECAST_TAB_LABELS).map(([kind,label]) => `<button type="button" role="tab" class="${counts[kind] ? '' : 'is-zero'}" id="forecast-tab-${kind}" data-f-filter="${kind}" aria-controls="forecast-dashboard-tables" aria-selected="${activeTab === kind}" tabindex="${activeTab === kind ? 0 : -1}">${label} <span class="forecast-count">${counts[kind]}</span></button>`).join('')}</nav><input id="forecast-dashboard-search" type="search" aria-label="Rechercher dans les devis de cet onglet" placeholder="Client, numéro ou titre…" value="${esc(search)}"></div><div id="forecast-dashboard-tables" class="forecast-dashboard-tables" role="tabpanel" aria-labelledby="forecast-tab-${activeTab}">${tables}</div><p id="forecast-quick-message" class="small" role="status"></p>`;
}

export function renderForecastSummary({ summary, goal, reviewCount, reviewAmount, reviewUnknown, warning, counts, money, escape: esc }) {
  const coverage = forecastCoverage(summary, goal);
  const estimated = summary.confirmed;
  const scale = coverage ? Math.max(coverage.need, estimated) : 0;
  const covered = coverage ? Math.min(coverage.need, estimated) : 0;
  const surplus = coverage ? -coverage.balance : 0;
  const labels = FORECAST_TAB_LABELS;
  const potential = (kind, amount, note) => {
    const empty = amount === 0 && !counts[kind];
    const foot = empty
      ? '<span>Aucun devis</span>'
      : `<span>${note}</span><button class="forecast-link" data-f-jump="${kind}">${counts[kind] === 1 ? 'Voir le devis' : `Voir les ${counts[kind]} devis`} →</button>`;
    return `<aside class="forecast-potential forecast-potential-${kind}${empty ? ' is-empty' : ''}" aria-label="${labels[kind]}"${empty ? ' aria-disabled="true"' : ''}><h3>${labels[kind]}</h3><strong>${money(amount)} <small>HT</small></strong><div class="forecast-potential-foot">${foot}</div></aside>`;
  };
  const showReview = reviewAmount !== 0 || reviewUnknown > 0;
  const columns = 3;
  return `<div class="forecast-head"><div><h2 id="forecast-title">Chiffre d’affaires prévisionnel</h2><p class="small">Restant à facturer · exercice ${esc(summary.year)} · montants HT</p></div></div>${warning}
    <div class="forecast-future-layout" data-potential-columns="${columns}">
      <section id="cap-forecast" class="forecast-coverage" aria-label="Couverture du CA restant à produire">
        <div class="forecast-estimated"><strong>${money(estimated)}</strong> <span>HT · À facturer (estimation)</span></div>
        ${coverage ? `
        <div class="forecast-scale"><div class="forecast-threshold ${surplus <= 0 ? 'at-end' : coverage.need === 0 ? 'at-start' : ''}" style="--threshold:${scale ? coverage.need / scale * 100 : 100}%"><span>Objectif ${money(coverage.need)} HT</span></div>
          <div class="forecast-coverage-track ${surplus < 0 ? 'shortfall' : ''}" role="img" aria-label="${esc(money(estimated))} HT estimés pour un besoin de ${esc(money(coverage.need))} HT ; ${esc(money(Math.abs(surplus)))} HT ${surplus < 0 ? 'à trouver' : 'de dépassement estimé'}"><span style="width:${scale ? covered / scale * 100 : 0}%"></span>${surplus > 0 ? `<span class="forecast-excess" style="width:${surplus / scale * 100}%"></span>` : ''}</div>
          <div class="forecast-coverage-legend"><span><span><i></i>${surplus < 0 ? 'Besoin couvert par l’estimé' : 'Besoin couvert'}</span><strong>${money(covered)} HT</strong></span><span><span><i class="${surplus < 0 ? 'forecast-gap-dot' : 'forecast-excess-dot'}"></i>${surplus < 0 ? 'Reste à trouver' : 'Dépassement estimé'}</span><strong>${surplus > 0 ? '+' : ''}${money(Math.abs(surplus))} HT</strong></span></div>
        </div>` : '<p class="small">Besoin indisponible : un objectif et une période RES couverte sont nécessaires.</p>'}
      </section>
      ${`<div class="forecast-potentials" style="--potential-columns:${columns}">
        ${potential('waiting', summary.waiting, 'Hors estimation')}
        ${potential('validation', summary.validation, 'Hors estimation')}
        ${(() => {
          const empty = !showReview;
          const amount = reviewUnknown === reviewCount && reviewCount > 0 ? 'À déterminer' : money(reviewAmount) + ' <small>HT</small>';
          const foot = empty
            ? '<span>Aucun devis</span>'
            : `<span>Montants indicatifs · hors totaux${reviewUnknown ? ` · ${reviewUnknown} non renseigné(s)` : ''}</span><button class="forecast-link" data-f-jump="review">Vérifier ${reviewCount} devis →</button>`;
          return `<aside class="forecast-potential forecast-review-card${empty ? ' is-empty' : ''}" aria-label="À examiner"${empty ? ' aria-disabled="true"' : ''}><h3>À examiner</h3><strong>${amount}</strong><div class="forecast-potential-foot">${foot}</div></aside>`;
        })()}
      </div>`}
    </div>
    ${summary.reviewCount ? `<p class="forecast-warning">${summary.reviewCount} devis sélectionné(s) à vérifier après actualisation du rapprochement. Leurs montants saisis sont conservés, mais suspendus des totaux. <button class="forecast-link" data-f-jump="review">Vérifier</button></p>` : ''}
    <div class="forecast-details-row"><button type="button" class="forecast-link forecast-open-quotes" data-f-action="quotes" aria-haspopup="dialog">Afficher les devis →</button>
      <button class="forecast-link" data-f-action="manage">Ajouter ou retrouver un devis</button>
    </div>
    ${summary.unintegrated.length ? `<details class="forecast-method"><summary>${summary.unintegrated.length} facture(s) / avoir(s) après la période RES · à rapprocher</summary><p>Ces pièces ne sont pas ajoutées automatiquement : elles pourraient recouper les devis sélectionnés.</p><ul>${summary.unintegrated.map(d => `<li>${esc(d.date)} · ${esc(d.number || d.type)} · ${esc(d.client)} : ${money(d.amount)} HT</li>`).join('')}</ul></details>` : ''}`;
}
