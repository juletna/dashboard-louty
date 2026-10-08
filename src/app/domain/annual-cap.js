import { getMetricSeries, hasObservedValue, isPeriodCovered } from './schema.js';
import { sumPeriod } from './metrics.js';

// A closing month whose operating charges fall below this share of the earlier
// months' average is most likely not fully booked yet in the export.
const INCOMPLETE_CHARGES_RATIO = 0.25;

function incompleteChargesMonth(year, month) {
  const series = getMetricSeries(year, 'charges_fonct');
  const last = series[month - 1];
  if (!Number.isFinite(last)) return month;
  const earlier = series.slice(0, month - 1).filter(Number.isFinite);
  if (earlier.length < 2) return null;
  const average = earlier.reduce((sum, value) => sum + value, 0) / earlier.length;
  return average > 0 && last < average * INCOMPLETE_CHARGES_RATIO ? month : null;
}

// Capacity before remuneration: paid salaries are deliberately not deducted.
// Cooperative contribution is booked late, so it is never taken below the
// historical share of the margin (contributionRate) when one is provided.
export function salaryCapacityAtDate(year, yearKey, endMonth, exportISO, netCoefficient, contributionRate = null) {
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
  const margin = sumPeriod(year, 'marge_brute', month) ?? 0;
  const charges = sumPeriod(year, 'charges_fonct', month) ?? 0;
  const contributionBooked = sumPeriod(year, 'contribution_coop', month) ?? 0;
  const contributionEstimated = Number.isFinite(contributionRate) && contributionRate > 0 ? margin * contributionRate : 0;
  const contribution = Math.max(contributionBooked, contributionEstimated);
  const availableGross = margin - charges - contribution;
  return {
    monthlyNet:Math.max(0, availableGross) * netCoefficient / elapsedMonths, availableGross, elapsedMonths,
    year:Number(yearKey), month, day:partial ? date.getDate() : null, netCoefficient,
    margin, charges, contributionBooked, contribution, contributionRate:contributionEstimated > contributionBooked ? contributionRate : null,
    incompleteMonth:incompleteChargesMonth(year, month),
  };
}

export function projectedPlanResult(projectedMargin, plan) {
  return Number.isFinite(projectedMargin) && Number.isFinite(plan.salary) && Number.isFinite(plan.charges)
    ? projectedMargin - plan.salary - plan.charges : null;
}
