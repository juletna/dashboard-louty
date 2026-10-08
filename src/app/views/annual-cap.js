// The overview receives computed amounts; business rules live in the domain.
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

export function renderCapProjections(host, { year, salary, result, margin, revenue, goals, salaryHelp, revenueHelp }, { money, escape }) {
  const cards = [
    ['Salaire net dégageable', salary, goals.salary, true, salaryHelp, 'Détail du calcul du salaire net dégageable'],
    ['Projection résultat ' + year, result, goals.result],
    ['Projection marge brute ' + year, margin, goals.margin],
    ['Projection chiffre d’affaires ' + year, revenue, goals.revenue, false, revenueHelp, 'Détail du calcul de la projection du chiffre d’affaires'],
  ];
  host.innerHTML = cards.map(([title, value, goal, monthly, helpHtml, helpLabel]) => {
    const available = Number.isFinite(value);
    const delta = available ? Math.round(value - goal) : null;
    const help = helpHtml
      ? '<span class="sp-help" data-tip-html="' + escape(helpHtml) + '" tabindex="0" role="button" aria-label="' + escape(helpLabel) + '">?</span>' : '';
    return '<article class="cap-projection"><h4>' + escape(title) + help + '</h4>' +
      '<strong class="cap-projection-value">' + (available ? '≈ ' + money(value) : '—') +
      (monthly ? ' <span class="cap-projection-unit">/ mois</span>' : '') + '</strong>' +
      '<span class="cap-projection-delta ' + (available ? (delta >= 0 ? 'positive' : 'negative') : 'unavailable') + '">' +
      (available ? (delta > 0 ? '+' : '') + money(delta) + ' vs objectif' : 'Projection indisponible') + '</span>' +
      '<span class="cap-projection-goal">Objectif : <b>' + money(goal) + '</b></span>' + (monthly ? '<span class="cap-salary-context">À date · résultat à l’équilibre</span>' : '') + '</article>';
  }).join('');
}
