import { sumPeriod } from './metrics.js';
import { isPeriodCovered, isFiniteNumber, hasObservedValue } from './schema.js';

const round = value => Math.round(value * 100) / 100;

// Shared annual scenario for the overview and graphs. No statistical CA fallback.
export function forecastProjection(data) {
  const forecast = data?.forecast;
  if (!forecast?.cutoff || !isFiniteNumber(forecast.actual)) return null;
  const end = Number(forecast.cutoff.slice(5));
  const source = data.years?.[forecast.year];
  if (!Number.isInteger(end) || end < 1 || end > 12 || !isPeriodCovered(source, end)) return null;
  // Missing Pièces is not a zero order book. A closed exercise needs no future estimate.
  if (end < 12 && !Array.isArray(data.revenue_distribution?.documents)) return null;
  const monthly = Array.from({ length:12 }, (_, i) => i >= end && isFiniteNumber(forecast.monthly?.[i]) ? forecast.monthly[i] : 0);
  const futureCA = monthly.reduce((sum, value) => sum + value, 0);
  const actualMB = sumPeriod(source, 'marge_brute', end);
  const referenceYears = Object.keys(data.years).filter(year => year < forecast.year &&
    isPeriodCovered(data.years[year], 12) && ['ca', 'marge_brute'].every(key => hasObservedValue(data.years[year].monthly[key])))
    .sort().slice(-2);
  const referenceCA = referenceYears.reduce((sum, year) => sum + sumPeriod(data.years[year], 'ca'), 0);
  const referenceMB = referenceYears.reduce((sum, year) => sum + sumPeriod(data.years[year], 'marge_brute'), 0);
  const rate = referenceCA > 0 ? referenceMB / referenceCA : null;
  // Same reference years as the margin rate: the contribution follows the margin, not a fixed amount.
  const contributionKnown = referenceYears.length > 0 && referenceYears.every(year => hasObservedValue(data.years[year].monthly.contribution_coop));
  const referenceContribution = contributionKnown ? referenceYears.reduce((sum, year) => sum + (sumPeriod(data.years[year], 'contribution_coop') ?? 0), 0) : null;
  const contributionRate = referenceContribution !== null && referenceMB > 0 ? referenceContribution / referenceMB : null;
  const totalCA = forecast.actual + futureCA;
  const futureMargin = futureCA === 0 ? 0 : rate === null ? null : futureCA * rate;
  const futureCosts = futureMargin === null ? null : futureCA - futureMargin;
  const totalMB = actualMB === null || futureMargin === null ? null : actualMB + futureMargin;
  return {
    end, actualCA:forecast.actual, actualMB, futureCA:round(futureCA),
    totalCA:round(totalCA), totalMB:totalMB === null ? null : round(totalMB),
    futureCosts, rate, contributionRate, referenceYears, reference:referenceYears.join(' et ') || 'historique indisponible',
    unavailable:actualMB === null ? 'Marge réalisée indisponible sur la période.' : futureMargin === null ? 'Taux de marge historique indisponible.' : null,
  };
}

// Only extend graphs when there is future work; zero remains usable on annual cards.
export function forecastOutlook(data) {
  const projection = forecastProjection(data);
  if (!projection || !(projection.futureCA > 0)) return null;
  const { end, actualMB, futureCA, futureCosts, totalMB } = projection;
  const forecast = data.forecast;
  const monthly = Array.from({ length:12 }, (_, i) => i >= end && isFiniteNumber(forecast.monthly?.[i]) ? forecast.monthly[i] : 0);
  const last = forecast.monthly.findLastIndex((value, i) => i >= end && isFiniteNumber(value));
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
  return { ...projection, ca, mb, monthlyCosts, monthlyMargin, last };
}
