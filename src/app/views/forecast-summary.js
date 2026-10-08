import { forecastCalendar, forecastCoverage } from '../domain/forecast.js';

// Presentation only: reconciliation, coverage and monetary rounding stay in the domain.
export function renderForecastSummary({ summary, goal, reviewCount, warning, expanded, search, tables, money, escape: esc }) {
  const coverage = forecastCoverage(summary, goal);
  const confirmed = coverage?.confirmed ?? summary.annualConfirmed + summary.undated;
  const months = forecastCalendar(summary.active);
  const max = Math.max(100, Math.ceil(Math.max(0, ...months.map(v => v.confirmed)) / 1000) * 1000);
  const count = kind => summary.included.filter(r => r.choice.situation === kind && r.choice.remaining !== 0).length;
  const undated = summary.included.filter(r => r.choice.situation === 'confirmed' && r.choice.remaining !== 0 && !r.choice.month).length;
  const dateLabel = (month, short = false) => new Date(month + '-01T12:00:00').toLocaleDateString('fr-FR', { month: short ? 'short' : 'long', year: 'numeric' });
  const help = 'Montants HT. Le reste à produire correspond à l’objectif annuel moins le CA réalisé. La jauge inclut les devis confirmés et vérifiés sans mois prévu ainsi que ceux planifiés après la période RES, jusqu’à fin ' + summary.year + '. Les devis sans date restent à planifier et ne sont pas ajoutés au cumul annuel. Les échéances hors période et les attentes client sont exclues. Les rapprochements restent indicatifs ; les choix manuels sont conservés. Ce scénario ne s’ajoute pas à la projection statistique.';
  return `<div class="forecast-head"><h2 id="forecast-title">Chiffre d’affaires prévisionnel <button type="button" class="sp-help forecast-help" data-tip="${esc(help)}" aria-label="Comprendre le prévisionnel">ⓘ</button></h2><button class="btn" data-f-action="manage">Vérifier les devis</button></div>${warning}
    <div class="forecast-future-layout">
      <section id="cap-forecast" class="forecast-coverage" aria-label="Couverture du CA restant à produire">
        <h3>Reste à produire d’ici fin ${esc(summary.year)}</h3><strong class="forecast-need">${coverage ? money(coverage.need) : 'Indisponible'}</strong>
        ${coverage ? `<div class="forecast-coverage-track" role="img" aria-label="${esc(money(coverage.need))} restant à produire, ${esc(money(confirmed))} confirmés${coverage.balance >= 0 ? ', ' + esc(money(coverage.balance)) + ' à trouver' : ', besoin couvert'}"><span style="width:${coverage.percent}%"></span></div>` : '<p class="small">Un objectif et une période réalisée complète sont nécessaires pour calculer le besoin.</p>'}
        <div class="forecast-coverage-legend"><span><i></i>Confirmé <strong>${money(confirmed)}</strong></span>${coverage ? `<span><i class="forecast-gap-dot"></i>${coverage.balance < 0 ? 'Au-delà du besoin' : 'À trouver'} <strong>${money(Math.abs(coverage.balance))}</strong></span>` : ''}</div>
        ${summary.undated > 0 ? `<p class="small">Dont ${money(summary.undated)} HT à planifier · inclus dans la jauge, hors cumul annuel tant que le mois prévu n’est pas renseigné.</p>` : ''}
      </section>
      <section class="forecast-schedule" aria-label="Facturation prévue"><div class="forecast-head"><h3>Facturation prévue</h3><span class="small">Montants HT</span></div>
        ${months.length ? `<div class="forecast-chart-scroll"><div class="forecast-chart" style="min-width:${Math.max(240, months.length * 70)}px"><div class="forecast-columns" style="grid-template-columns:repeat(${months.length},minmax(0,1fr))">${months.map(v => {
          const outside = v.month.slice(0, 4) !== summary.year || (summary.cutoff && v.month <= summary.cutoff);
          return `<button class="forecast-column${outside ? ' forecast-column-outside' : ''}" data-f-month="${esc(v.month)}" aria-label="${esc(dateLabel(v.month))} : ${esc(money(v.confirmed))} HT confirmés${outside ? ', hors jauge' : ''}"><span class="forecast-column-bar" style="height:${v.confirmed / max * 100}%"><b>${money(v.confirmed)}</b></span><span class="forecast-column-label">${esc(dateLabel(v.month, true))}${outside ? '<small>Hors jauge</small>' : ''}</span></button>`;
        }).join('')}</div></div></div>` : '<p class="small">Aucun chantier confirmé daté. Précise les échéances dans « À planifier ».</p>'}
      </section>
      <aside class="forecast-potential"><h3>Potentiel CA</h3><strong>${money(summary.waiting)}</strong><p>Devis en attente de réponse</p></aside>
    </div>
    ${summary.reviewCount ? `<p class="forecast-warning">${summary.reviewCount} devis sélectionné(s) à vérifier après actualisation du rapprochement. Leurs montants saisis sont conservés, mais suspendus des totaux. <button class="forecast-link" data-f-action="selected">Vérifier</button></p>` : ''}
    ${summary.coveredCount ? `<p class="small">${summary.coveredCount} devis prévu(s) sur une période déjà couverte par le RES : à replanifier. Non ajoutés au réalisé.</p>` : ''}
    <div class="forecast-details-row"><details id="forecast-followed" class="forecast-followed" ${expanded ? 'open' : ''}><summary><span class="forecast-show-label">Afficher le tableau des devis →</span><span class="forecast-hide-label">Masquer le tableau des devis ↑</span></summary>
      <div class="forecast-table-toolbar"><input id="forecast-dashboard-search" type="search" aria-label="Rechercher les devis suivis" placeholder="Rechercher…" value="${esc(search)}"></div><div id="forecast-dashboard-tables" class="forecast-dashboard-tables">${tables}</div></details>
      <nav class="forecast-quick-filters" aria-label="Catégoriser les devis"><button class="forecast-link" data-f-filter="confirmed" aria-haspopup="dialog">Confirmés · ${count('confirmed')}</button><button class="forecast-link" data-f-filter="waiting" aria-haspopup="dialog">En attente · ${count('waiting')}</button><button class="forecast-link" data-f-action="review" aria-haspopup="dialog">À examiner · ${reviewCount}</button><button class="forecast-link" data-f-filter="undated" aria-haspopup="dialog">À planifier · ${undated}</button></nav>
    </div>
    ${summary.unintegrated.length ? `<details class="forecast-method"><summary>${summary.unintegrated.length} facture(s) / avoir(s) après la période RES · à rapprocher</summary><p>Ces pièces ne sont pas ajoutées automatiquement : elles pourraient recouper les devis sélectionnés.</p><ul>${summary.unintegrated.map(d => `<li>${esc(d.date)} · ${esc(d.number || d.type)} · ${esc(d.client)} : ${money(d.amount)} HT</li>`).join('')}</ul></details>` : ''}`;
}
