import { historicalPlanReference, sumPeriod } from './metrics.js';
import { isPeriodCovered, isFiniteNumber } from './schema.js';

const round = value => Math.round(value * 100) / 100;

// A scenario for the dated, confirmed order book, not the seasonal projection.
// Costs already incurred consume the annual envelope before future costs are estimated.
export function forecastOutlook(data) {
  const forecast = data?.forecast;
  if (!forecast?.cutoff || !isFiniteNumber(forecast.actual)) return null;
  const end = Number(forecast.cutoff.slice(5));
  const source = data.years?.[forecast.year];
  if (!end || !isPeriodCovered(source, end)) return null;
  const monthly = Array.from({ length:12 }, (_, i) => i >= end && isFiniteNumber(forecast.monthly?.[i]) ? forecast.monthly[i] : 0);
  const futureCA = monthly.reduce((sum, value) => sum + value, 0);
  if (!(futureCA > 0)) return null;
  const last = monthly.findLastIndex(value => value !== 0);
  const actualMB = sumPeriod(source, 'marge_brute', end);
  const reference = historicalPlanReference(data, {});
  const referenceCA = reference.years.reduce((sum, year) => sum + sumPeriod(data.years[year], 'ca'), 0);
  const rate = referenceCA > 0 ? reference.margin : null;
  const validRate = isFiniteNumber(rate) && rate >= 0 && rate <= 1;
  const totalCA = forecast.actual + futureCA;
  const actualCosts = actualMB === null ? null : forecast.actual - actualMB;
  const annualCosts = validRate ? totalCA * (1 - rate) : null;
  const futureCosts = actualCosts !== null && annualCosts !== null ? Math.max(0, annualCosts - actualCosts) : null;
  const totalMB = futureCosts === null ? null : actualMB + futureCA - futureCosts;
  const ca = Array(12).fill(null), mb = Array(12).fill(null);
  ca[end - 1] = forecast.actual;
  if (totalMB !== null) mb[end - 1] = actualMB;
  const monthlyCosts = Array(12).fill(null), monthlyMargin = Array(12).fill(null);
  let added = 0, allocatedCosts = 0;
  for (let i = end; i <= last; i++) {
    added += monthly[i];
    ca[i] = round(forecast.actual + added);
    if (totalMB !== null) {
      mb[i] = round(actualMB + added - futureCosts * added / futureCA);
      const costsToDate = round(futureCosts * added / futureCA);
      if (isFiniteNumber(forecast.monthly?.[i])) {
        monthlyCosts[i] = round(costsToDate - allocatedCosts);
        monthlyMargin[i] = round(monthly[i] - monthlyCosts[i]);
      }
      allocatedCosts = costsToDate;
    }
  }
  return {
    ca, mb, monthlyCosts, monthlyMargin, end, last, actualCA:forecast.actual, actualMB, futureCA:round(futureCA),
    totalCA:round(totalCA), totalMB:totalMB === null ? null : round(totalMB),
    actualCosts, annualCosts, futureCosts, rate:validRate ? rate : null, reference:reference.label,
    unavailable:actualMB === null ? 'Marge réalisée indisponible sur la période.' : !validRate ? 'Taux de marge historique exploitable indisponible.' : null,
  };
}
