// The overview receives computed amounts; business rules live in the domain.
export function renderCapProjections(host, { year, salary, result, margin, revenue, goals }, { money, escape }) {
  const cards = [
    ['Salaire net dégageable', salary, goals.salary, true],
    ['Projection résultat ' + year, result, goals.result],
    ['Projection marge brute ' + year, margin, goals.margin],
    ['Projection chiffre d’affaires ' + year, revenue, goals.revenue],
  ];
  host.innerHTML = cards.map(([title, value, goal, monthly]) => {
    const available = Number.isFinite(value);
    const delta = available ? Math.round(value - goal) : null;
    return '<article class="cap-projection"><h4>' + escape(title) + '</h4>' +
      '<strong class="cap-projection-value">' + (available ? '≈ ' + money(value) : '—') +
      (monthly ? ' <span class="cap-projection-unit">/ mois</span>' : '') + '</strong>' +
      '<span class="cap-projection-delta ' + (available ? (delta >= 0 ? 'positive' : 'negative') : 'unavailable') + '">' +
      (available ? (delta > 0 ? '+' : '') + money(delta) + ' vs objectif' : 'Projection indisponible') + '</span>' +
      '<span class="cap-projection-goal">Objectif : <b>' + money(goal) + '</b></span>' + (monthly ? '<span class="cap-salary-context">À date · résultat à l’équilibre</span>' : '') + '</article>';
  }).join('');
}
