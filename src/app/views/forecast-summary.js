import { forecastCoverage } from '../domain/forecast.js';

// Presentation only: reconciliation, coverage and monetary rounding stay in the domain.
export function renderForecastSummary({ summary, goal, reviewCount, warning, expanded, search, tables, money, escape: esc }) {
  const coverage = forecastCoverage(summary, goal);
  const confirmed = summary.confirmed;
  const count = kind => summary.active.filter(r => r.choice.situation === kind && r.choice.remaining !== 0).length;
  const help = 'Montants HT. Le reste à produire correspond à l’objectif annuel moins le CA réalisé. La jauge inclut tous les devis confirmés et vérifiés. Pour les graphiques annuels, le confirmé est réparti uniformément sur les mois restant après la période RES, jusqu’à décembre. Cette répartition est un scénario, pas un calendrier de facturation. Les attentes client et de validation restent séparées. Les rapprochements sont indicatifs ; les choix manuels restent prioritaires. Ce scénario ne s’ajoute pas à la projection statistique.';
  return `<div class="forecast-head"><h2 id="forecast-title">Chiffre d’affaires prévisionnel <button type="button" class="sp-help forecast-help" data-tip="${esc(help)}" aria-label="Comprendre le prévisionnel">ⓘ</button></h2><button class="btn" data-f-action="manage">Vérifier les devis</button></div>${warning}
    <div class="forecast-future-layout">
      <section id="cap-forecast" class="forecast-coverage" aria-label="Couverture du CA restant à produire">
        <h3>Reste à produire d’ici fin ${esc(summary.year)}</h3><strong class="forecast-need">${coverage ? money(coverage.need) : 'Indisponible'}</strong>
        ${coverage ? `<div class="forecast-coverage-track" role="img" aria-label="${esc(money(coverage.need))} restant à produire, ${esc(money(confirmed))} confirmés${coverage.balance >= 0 ? ', ' + esc(money(coverage.balance)) + ' à trouver' : ', besoin couvert'}"><span style="width:${coverage.percent}%"></span></div>` : '<p class="small">Un objectif et une période réalisée complète sont nécessaires pour calculer le besoin.</p>'}
        <div class="forecast-coverage-legend"><span><i></i>Confirmé <strong>${money(confirmed)}</strong></span>${coverage ? `<span><i class="forecast-gap-dot"></i>${coverage.balance < 0 ? 'Au-delà du besoin' : 'À trouver'} <strong>${money(Math.abs(coverage.balance))}</strong></span>` : ''}</div>
        <p class="small">${summary.annualConfirmed > 0 ? 'Confirmé réparti uniformément sur les mois restants jusqu’à décembre.' : 'La projection annuelle nécessite une période RES exploitable et des mois restant dans l’exercice.'}</p>
      </section>
      <aside class="forecast-potential" aria-label="En attente client"><h3>En attente client</h3><strong>${money(summary.waiting)}</strong><p>Devis sans accord client</p><button class="forecast-link" data-f-filter="waiting" aria-haspopup="dialog">Voir les devis · ${count('waiting')}</button></aside>
      <aside class="forecast-potential" aria-label="En attente de validation"><h3>En attente de validation</h3><strong>${money(summary.validation)}</strong><p>Devis à valider</p><button class="forecast-link" data-f-filter="validation" aria-haspopup="dialog">Voir les devis · ${count('validation')}</button></aside>
    </div>
    ${summary.reviewCount ? `<p class="forecast-warning">${summary.reviewCount} devis sélectionné(s) à vérifier après actualisation du rapprochement. Leurs montants saisis sont conservés, mais suspendus des totaux. <button class="forecast-link" data-f-action="selected">Vérifier</button></p>` : ''}
    <div class="forecast-details-row"><details id="forecast-followed" class="forecast-followed" ${expanded ? 'open' : ''}><summary><span class="forecast-show-label">Afficher le tableau des devis →</span><span class="forecast-hide-label">Masquer le tableau des devis ↑</span></summary>
      <div class="forecast-table-toolbar"><input id="forecast-dashboard-search" type="search" aria-label="Rechercher les devis suivis" placeholder="Rechercher…" value="${esc(search)}"></div><div id="forecast-dashboard-tables" class="forecast-dashboard-tables">${tables}</div></details>
      <nav class="forecast-quick-filters" aria-label="Catégoriser les devis"><button class="forecast-link" data-f-filter="confirmed" aria-haspopup="dialog">Confirmés · ${count('confirmed')}</button><button class="forecast-link" data-f-filter="waiting" aria-haspopup="dialog">En attente client · ${count('waiting')}</button><button class="forecast-link" data-f-action="review" aria-haspopup="dialog">À examiner · ${reviewCount}</button><button class="forecast-link" data-f-filter="validation" aria-haspopup="dialog">À valider · ${count('validation')}</button></nav>
    </div>
    ${summary.unintegrated.length ? `<details class="forecast-method"><summary>${summary.unintegrated.length} facture(s) / avoir(s) après la période RES · à rapprocher</summary><p>Ces pièces ne sont pas ajoutées automatiquement : elles pourraient recouper les devis sélectionnés.</p><ul>${summary.unintegrated.map(d => `<li>${esc(d.date)} · ${esc(d.number || d.type)} · ${esc(d.client)} : ${money(d.amount)} HT</li>`).join('')}</ul></details>` : ''}`;
}
