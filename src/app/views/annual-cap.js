// The overview receives computed amounts; business rules live in the domain.
import { KPI_ICONS, renderKpiCard } from './kpi-card.js';

const INTRO = 'Ce que ton activité aurait pu te verser par mois depuis janvier, en finissant à zéro de résultat.';

function row(label, value, className = '') {
  return '<div class="tip-row' + (className ? ' ' + className : '') + '"><span>' + label + '</span><b>' + value + '</b></div>';
}

function periodLabel(capacity) {
  const end = new Date(capacity.year, capacity.month - 1, capacity.day || 1);
  const until = capacity.day ? capacity.day + ' ' + end.toLocaleDateString('fr-FR', { month:'short' }) : 'fin ' + end.toLocaleDateString('fr-FR', { month:'long' });
  return '1er janv. → ' + until + ' ' + capacity.year + ' · ' + capacity.elapsedMonths.toLocaleString('fr-FR', { maximumFractionDigits:2 }) + ' mois';
}

// Plain-text numbers are escaped here: the result is injected as HTML by the tooltip.
export function salaryCapacityHelp(capacity, { money, escape }) {
  const head = '<strong class="tip-title">Salaire net dégageable</strong><p>' + INTRO + '</p>';
  if (!capacity || !Number.isFinite(capacity.monthlyNet) || !Number.isFinite(capacity.elapsedMonths) || !capacity.month) {
    return head + '<p>Calcul indisponible : date de l’export ou données de la période manquantes.</p>';
  }
  const e = (value) => escape(money(value));
  const monthName = new Date(capacity.year, capacity.month - 1, 1).toLocaleDateString('fr-FR', { month:'long' }).replace(/^./, (c) => c.toUpperCase());
  return head + '<p class="tip-period">' + escape(periodLabel(capacity)) + '</p>' +
    '<div class="tip-calc">' +
      row('Marge brute', e(capacity.margin)) +
      row('− Charges', e(capacity.charges)) +
      row('− Contribution' + (capacity.contributionRate === null ? '' : ' (estimée)'), e(capacity.contribution)) +
      row('= Disponible', e(capacity.availableGross), 'tip-total') +
    '</div>' +
    '<p class="tip-formula">× ' + capacity.netCoefficient.toLocaleString('fr-FR', { maximumFractionDigits:4 }) + ' (brut → net) ÷ ' +
      capacity.elapsedMonths.toLocaleString('fr-FR', { maximumFractionDigits:2 }) + ' mois</p>' +
    (capacity.availableGross < 0
      ? '<p class="tip-result">Aucun salaire finançable : déficit de ' + e(-capacity.availableGross) + ' avant rémunération.</p>'
      : '<p class="tip-result">≈ ' + e(capacity.monthlyNet) + ' net / mois</p>') +
    (capacity.incompleteMonth ? '<p class="tip-warning">⚠ ' + escape(monthName) + ' semble incomplet dans ton export : le chiffre est peut-être trop optimiste.</p>' : '');
}

const REVENUE_INTRO = 'Ce que tu as déjà facturé, plus ce qu’il reste à facturer sur tes devis acceptés.';

function monthName(year, month, style = 'long') {
  return new Date(Number(year), month - 1, 1).toLocaleDateString('fr-FR', { month:style });
}

function exportLabel(iso) {
  const date = iso ? new Date(iso) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' }) : null;
}

// quotes: confirmed count, plus the amounts and counts kept out of the estimate.
export function revenueProjectionHelp({ projection, year, quotes = {}, exportIso }, { money, escape }) {
  const head = '<strong class="tip-title">Projection du chiffre d’affaires ' + escape(year) + '</strong><p>' + REVENUE_INTRO + '</p>';
  if (!projection || !Number.isFinite(projection.totalCA)) {
    return head + '<p>Calcul indisponible : importe les Pièces et une période RES complète à date.</p>';
  }
  const e = (value) => escape(money(value));
  const { end, actualCA, futureCA, totalCA } = projection;
  const closed = end === 12;
  const exported = exportLabel(exportIso);
  const period = 'Réalisé janv. → ' + monthName(year, end, 'short') + ' ' + year + (exported ? ' (export du ' + exported + ')' : '') +
    (closed ? '' : ' · estimé ' + monthName(year, end + 1, 'short') + (end + 1 === 12 ? '' : ' → déc.'));
  const count = Number.isFinite(quotes.confirmed) ? ' (' + quotes.confirmed + ' devis)' : '';
  const excluded = [
    quotes.waiting > 0 ? 'en attente ' + money(quotes.waiting) : null,
    quotes.validation > 0 ? 'à valider ' + money(quotes.validation) : null,
    quotes.review > 0 ? quotes.review + ' à examiner' : null,
  ].filter(Boolean);
  return head + '<p class="tip-period">' + escape(period) + '</p>' +
    '<div class="tip-calc">' +
      row('CA réalisé', e(actualCA)) +
      (closed ? '' : row('+ Reste à facturer' + count, e(futureCA))) +
      row('= Projection', e(totalCA), 'tip-total') +
    '</div>' +
    (excluded.length ? '<p class="tip-formula">Non comptés : ' + escape(excluded.join(' · ')) + '</p>' : '') +
    '<p class="tip-result">≈ ' + e(totalCA) + ' HT sur ' + escape(year) + '</p>';
}

const RESULT_INTRO = 'Ce qu’il te resterait fin année : la marge gagnée, moins ton salaire et les charges prévus.';

function percent(rate) {
  return (rate * 100).toLocaleString('fr-FR', { maximumFractionDigits:1 }) + ' %';
}

// detail: projectedPlanResultDetail(); projection: forecastProjection(), for the covered period and the margin rate.
export function projectedResultHelp({ detail, projection, year }, { money, escape }) {
  const head = '<strong class="tip-title">Projection résultat ' + escape(year) + '</strong><p>' + RESULT_INTRO + '</p>';
  if (!detail || !projection) return head + '<p>Calcul indisponible : importe les Pièces et une période RES complète à date.</p>';
  const e = (value) => escape(money(value));
  const { end, actualMB, futureCA, rate, reference } = projection;
  const closed = end === 12;
  const period = 'Réalisé janv. → ' + monthName(year, end, 'short') + ' ' + year +
    (closed ? '' : ' · estimé ' + monthName(year, end + 1, 'short') + (end + 1 === 12 ? '' : ' → déc.'));
  const adjusted = detail.contributionRate !== null && Math.round(detail.adjustment) !== 0;
  const margin = 'Marge = ' + e(actualMB) + ' réalisés' +
    (closed || !(futureCA > 0) ? '' : ' + ' + e(futureCA) + ' HT à venir × ' + (rate === null ? 'taux indisponible' : percent(rate) + ' (moy. ' + escape(reference) + ')')) + '.';
  const surplus = detail.result >= 0;
  return head + '<p class="tip-period">' + escape(period) + '</p>' +
    '<div class="tip-calc">' +
      row('Marge brute projetée', e(detail.margin)) +
      row('− Salaire brut prévu (12 mois)', e(detail.salary)) +
      row('− Charges prévues (12 mois)', e(detail.charges)) +
      (adjusted ? row(detail.adjustment > 0 ? '− Ajustement contribution' : '+ Ajustement contribution', e(Math.abs(detail.adjustment))) : '') +
      row('= Résultat projeté', e(detail.result), 'tip-total') +
    '</div>' +
    '<p class="tip-formula">' + margin +
      (adjusted ? ' Ajustement = ' + percent(detail.contributionRate) + ' × l’écart de marge avec le plan (' + e(detail.margin - detail.planMargin) + ').' : '') +
      ' Salaire et charges sont ceux du plan, pas le réalisé.</p>' +
    '<p class="tip-result">≈ ' + e(Math.abs(detail.result)) + (surplus ? ' d’excédent' : ' de déficit') + '</p>';
}

const MARGIN_INTRO = 'Ce que tu as déjà gagné en marge, plus ce que tes devis restants devraient rapporter au taux habituel.';

// projection: forecastProjection(). The estimate applies one historical rate to the remaining confirmed quotes.
export function marginProjectionHelp({ projection, year, exportIso }, { money, escape }) {
  const head = '<strong class="tip-title">Projection marge brute ' + escape(year) + '</strong><p>' + MARGIN_INTRO + '</p>';
  if (!projection || !Number.isFinite(projection.totalMB)) {
    return head + '<p>' + escape(projection?.unavailable || 'Calcul indisponible : importe les Pièces et une période RES complète à date.') + '</p>';
  }
  const e = (value) => escape(money(value));
  const { end, actualCA, actualMB, futureCA, totalMB, rate, reference } = projection;
  const closed = end === 12;
  const remaining = !closed && futureCA > 0;
  const exported = exportLabel(exportIso);
  const period = 'Réalisé janv. → ' + monthName(year, end, 'short') + ' ' + year + (exported ? ' (export du ' + exported + ')' : '') +
    (remaining ?  ' · estimé ' + monthName(year, end + 1, 'short') + (end + 1 === 12 ? '' : ' → déc.') : '');
  const realized = actualCA > 0 ? actualMB / actualCA : null;
  const lower = remaining && rate !== null && realized !== null && realized < rate - 0.01;
  return head + '<p class="tip-period">' + escape(period) + '</p>' +
    '<div class="tip-calc">' +
      row('Marge réalisée', e(actualMB)) +
      (remaining ? row('+ Devis restants ' + e(futureCA) + ' × ' + percent(rate), e(totalMB - actualMB)) : '') +
      row('= Projection', e(totalMB), 'tip-total') +
    '</div>' +
    '<p class="tip-formula">' + (remaining
      ? 'Taux ' + percent(rate) + ' = marges brutes ÷ CA de ' + escape(reference) + ' (exercices complets). Le même taux est appliqué à tous les devis restants.'
      : closed ? 'Exercice terminé : marge réalisée uniquement.' : 'Aucun devis confirmé à facturer : marge réalisée uniquement.') + '</p>' +
    (lower ? '<p class="tip-warning">⚠ Ton taux réel ' + escape(year) + ' à date est de ' + percent(realized) + ' : la projection est peut-être un peu optimiste.</p>' : '') +
    '<p class="tip-result">≈ ' + e(totalMB) + ' de marge brute sur ' + escape(year) + '</p>';
}

export function renderCapProjections(host, { year, salary, result, margin, revenue, goals, salaryHelp, resultHelp, marginHelp, revenueHelp }, { money, escape }) {
  const cards = [
    ['Salaire net dégageable', salary, goals.salary, true, salaryHelp, 'Détail du calcul du salaire net dégageable', 'salary'],
    ['Projection résultat ' + year, result, goals.result, false, resultHelp, 'Détail du calcul de la projection du résultat', 'result'],
    ['Projection marge brute ' + year, margin, goals.margin, false, marginHelp, 'Détail du calcul de la projection de la marge brute', 'margin'],
    ['Projection chiffre d’affaires ' + year, revenue, goals.revenue, false, revenueHelp, 'Détail du calcul de la projection du chiffre d’affaires', 'revenue'],
  ];
  host.innerHTML = cards.map(([title, value, goal, monthly, helpHtml, helpLabel, icon]) => {
    const available = Number.isFinite(value);
    const delta = available ? Math.round(value - goal) : null;
    return renderKpiCard({
      tag: 'article', icon: KPI_ICONS[icon], label: title, classes: 'cap-projection', valueClass: 'cap-projection-value',
      help: helpHtml ? { html: helpHtml, label: helpLabel } : null,
      value: available ? '≈ ' + money(value) : '—', unit: monthly ? '/ mois' : '',
      delta: { tone: available ? (delta >= 0 ? 'good' : 'warn') : 'none', text: available ? (delta > 0 ? '+' : '') + money(delta) + ' vs objectif' : 'Projection indisponible' },
      meta: [['Objectif :', money(goal)], monthly ? 'À date · résultat à l’équilibre' : null]
    }, { escape });
  }).join('');
}
