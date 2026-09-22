import { getMetricSeries, hasObservedValue, isPeriodCovered } from './schema.js';
import { sumPeriod } from './metrics.js';

// Capacity before remuneration: paid salaries are deliberately not deducted.
export function salaryCapacityAtDate(year, yearKey, endMonth, exportISO, netCoefficient) {
  const unavailable = { monthlyNet:null, availableGross:null, elapsedMonths:null };
  if (!exportISO || !Number.isFinite(netCoefficient) || netCoefficient <= 0 || !endMonth) return unavailable;
  const date = new Date(exportISO);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() < Number(yearKey)) return unavailable;
  const sameYear = date.getFullYear() === Number(yearKey);
  const month = sameYear ? Math.min(endMonth, date.getMonth() + 1) : endMonth;
  const keys = ['marge_brute', 'charges_fonct', 'contribution_coop'];
  if (!isPeriodCovered(year, month) || !keys.every((key) => hasObservedValue(getMetricSeries(year, key), 1, 12))) return unavailable;
  const partial = sameYear && month === date.getMonth() + 1;
  const elapsedMonths = partial ? month - 1 + date.getDate() / new Date(date.getFullYear(), month, 0).getDate() : month;
  const availableGross = (sumPeriod(year, 'marge_brute', month) ?? 0) -
    (sumPeriod(year, 'charges_fonct', month) ?? 0) - (sumPeriod(year, 'contribution_coop', month) ?? 0);
  return { monthlyNet:Math.max(0, availableGross) * netCoefficient / elapsedMonths, availableGross, elapsedMonths };
}

export function projectedPlanResult(projectedMargin, plan) {
  return Number.isFinite(projectedMargin) && Number.isFinite(plan.salary) && Number.isFinite(plan.charges)
    ? projectedMargin - plan.salary - plan.charges : null;
}
