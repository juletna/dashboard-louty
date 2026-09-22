import {
  getMetricSeries,
  hasObservedEveryMonth,
  hasObservedValue,
  isCompleteHistoricalYear,
  isFiniteNumber,
  isPeriodCovered,
} from './schema.js';

const round2 = (value) => value === null ? null : Math.round(value * 100) / 100;

export function sumPeriod(year, key, endMonth = 12) {
  const series = getMetricSeries(year, key);
  if (!hasObservedValue(series, 1, endMonth)) return null;
  return series.slice(0, endMonth).reduce((sum, value) => sum + (isFiniteNumber(value) ? value : 0), 0);
}

export function lastObservedMonth(year, key) {
  const series = getMetricSeries(year, key);
  if (!series) return 0;
  let last = 0;
  series.forEach((value, index) => { if (isFiniteNumber(value)) last = index + 1; });
  return last;
}

function canComparePeriod(year, endMonth, keys) {
  return isPeriodCovered(year, endMonth) && keys.every((key) =>
    hasObservedEveryMonth(getMetricSeries(year, key), 1, endMonth));
}

function samePeriodTotals(year, endMonth) {
  const keys = ['marge_brute', 'ca', 'achats_matieres'];
  if (!canComparePeriod(year, endMonth, keys)) return null;
  return {
    mb_ytd: sumPeriod(year, 'marge_brute', endMonth),
    mb_full: sumPeriod(year, 'marge_brute'),
    ca_ytd: sumPeriod(year, 'ca', endMonth),
    ca_full: sumPeriod(year, 'ca'),
    achats_ytd: sumPeriod(year, 'achats_matieres', endMonth),
    achats_full: sumPeriod(year, 'achats_matieres'),
  };
}

function metricProjection(years, referenceKeys, key, endMonth, ytd) {
  const usableReferences = referenceKeys.filter((yearKey) =>
    hasObservedEveryMonth(getMetricSeries(years[yearKey], key), endMonth + 1, 12));
  if (ytd === null || !usableReferences.length) return null;
  const remaining = usableReferences.reduce((sum, yearKey) =>
    sum + sumPeriod(years[yearKey], key, 12) - sumPeriod(years[yearKey], key, endMonth), 0);
  return ytd + remaining / usableReferences.length;
}

export function computeSnapshot(data, config) {
  const years = data && data.years;
  const yearKeys = years ? Object.keys(years).sort() : [];
  if (!yearKeys.length) return null;
  const currentYear = yearKeys[yearKeys.length - 1];
  const currentIndex = yearKeys.indexOf(currentYear);
  const current = years[currentYear];
  const endMonth = lastObservedMonth(current, 'marge_brute');
  const ytdMB = sumPeriod(current, 'marge_brute', endMonth || 12);
  const ytdCA = sumPeriod(current, 'ca', endMonth || 12);
  const ytdPurchases = sumPeriod(current, 'achats_matieres', endMonth || 12);
  const mb = getMetricSeries(current, 'marge_brute') || [];
  const purchases = getMetricSeries(current, 'achats_matieres') || [];
  const samePeriod = {};
  for (let index = 0; index < currentIndex; index += 1) {
    const key = yearKeys[index];
    const totals = samePeriodTotals(years[key], endMonth);
    if (totals) samePeriod[key] = totals;
  }

  const referenceYears = yearKeys
    .slice(0, currentIndex)
    .filter((yearKey) => isCompleteHistoricalYear(years[yearKey]))
    .slice(-2);
  const referenceYear = referenceYears[referenceYears.length - 1] || null;
  const previous = referenceYear ? samePeriod[referenceYear] : null;
  const projectionMB = endMonth ? metricProjection(years, referenceYears, 'marge_brute', endMonth, ytdMB) : null;
  const projectionCA = endMonth ? metricProjection(years, referenceYears, 'ca', endMonth, ytdCA) : null;
  const projectionPurchases = endMonth ? metricProjection(years, referenceYears, 'achats_matieres', endMonth, ytdPurchases) : null;

  return {
    year: currentYear,
    ytd_ca: round2(ytdCA),
    ytd_mb: round2(ytdMB),
    ytd_achats: round2(ytdPurchases),
    taux_mb: ytdMB !== null && ytdCA !== null && ytdCA !== 0 ? Math.round((ytdMB / ytdCA) * 10000) / 10000 : null,
    mois_renseignes: endMonth,
    mb_par_mois: mb.filter(isFiniteNumber),
    achats_par_mois: purchases.filter(isFiniteNumber),
    mois_alerte: mb.filter((value) => isFiniteNumber(value) && value < config.MB_MIN).length,
    projection_mb_annuelle: endMonth && ytdMB !== null ? round2((ytdMB / endMonth) * 12) : null,
    projection_mb_seasonal: round2(projectionMB),
    projection_ca_seasonal: round2(projectionCA),
    projection_achats_seasonal: round2(projectionPurchases),
    growth_rate_mb: ytdMB !== null && previous && previous.mb_ytd ? ytdMB / previous.mb_ytd : null,
    growth_rate_ca: ytdCA !== null && previous && previous.ca_ytd ? ytdCA / previous.ca_ytd : null,
    reference_year: referenceYear,
    reference_years: referenceYears,
    same_period: samePeriod,
  };
}

function historicalReferenceKeys(years) {
  const keys = Object.keys(years || {}).sort();
  const currentKey = keys[keys.length - 1];
  const prior = keys.slice(0, -1).filter((key) => isCompleteHistoricalYear(years[key]));
  const references = prior.slice(-2);
  if (!references.length && currentKey && isCompleteHistoricalYear(years[currentKey])) return [currentKey];
  return references;
}

export function historicalPlanReference(data, config) {
  const years = data && data.years ? data.years : {};
  const references = historicalReferenceKeys(years);
  const hasHistoricalReference = references.length > 0;
  const totals = { ca: 0, mb: 0, achats: 0, remuneration: 0, charges: 0, contribution: 0 };
  references.forEach((key) => {
    const year = years[key];
    totals.ca += sumPeriod(year, 'ca') ?? 0;
    totals.mb += sumPeriod(year, 'marge_brute') ?? 0;
    totals.achats += sumPeriod(year, 'achats_matieres') ?? 0;
    totals.remuneration += sumPeriod(year, 'remunerations') ?? 0;
    totals.charges += sumPeriod(year, 'charges_fonct') ?? 0;
    totals.contribution += sumPeriod(year, 'contribution_coop') ?? 0;
  });
  const count = references.length || 1;
  const annualCharges = (totals.charges + totals.contribution) / count;
  const annualSalary = totals.remuneration / count;
  const annualMB = totals.mb / count;
  const latestKey = references[references.length - 1] || null;
  const latest = latestKey ? years[latestKey] : null;
  const n1ChargesFonct = sumPeriod(latest, 'charges_fonct') ?? 0;
  const n1Contribution = sumPeriod(latest, 'contribution_coop') ?? 0;
  const n1CA = sumPeriod(latest, 'ca') ?? 0;
  const n1MB = sumPeriod(latest, 'marge_brute') ?? 0;
  const n1Salary = sumPeriod(latest, 'remunerations') ?? 0;
  const n1Charges = n1ChargesFonct + n1Contribution;
  const n1NetResult = n1MB - n1Salary - n1Charges;
  return {
    years: references,
    label: references.length > 1 ? `${references[0]}–${references[references.length - 1]}` : (references[0] || 'historique indisponible'),
    salary: hasHistoricalReference ? n1Salary : config.MB_MIN * 12,
    surplus: Math.max(0, n1NetResult),
    ca: hasHistoricalReference ? totals.ca / count : config.CA_OBJ,
    margin: hasHistoricalReference && totals.ca !== 0 ? totals.mb / totals.ca : config.TAUX_OBJ,
    purchases: hasHistoricalReference && totals.ca !== 0 ? totals.achats / totals.ca : config.RATIO_CIBLE,
    charges: hasHistoricalReference ? annualCharges : Math.max(0, config.MB_AN_OBJ - config.MB_MIN * 12),
    n1: {
      year: latestKey || 'N-1',
      charges: n1Charges,
      chargesFonct: n1ChargesFonct,
      contribution: n1Contribution,
      salary: n1Salary,
      netResult: n1NetResult,
      surplus: Math.max(0, n1NetResult),
      margin: n1CA > 0 ? n1MB / n1CA : (totals.ca > 0 ? totals.mb / totals.ca : config.TAUX_OBJ),
    },
  };
}
