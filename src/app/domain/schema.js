export const METRIC_KEYS = [
  'marge_economique',
  'marge_brute',
  'ca',
  'achats_approv',
  'achats_matieres',
  'contribution_coop',
  'charges_fonct',
  'remunerations',
  'frais_km',
];

export const HISTORICAL_METRICS = [
  'ca',
  'marge_brute',
  'achats_matieres',
  'remunerations',
  'charges_fonct',
  'contribution_coop',
];

export function createDictionary() {
  return Object.create(null);
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeSeries(series) {
  if (!Array.isArray(series)) return null;
  const normalized = new Array(12).fill(null);
  for (let index = 0; index < Math.min(series.length, 12); index += 1) {
    const value = series[index];
    if (value === null || value === undefined) continue;
    if (!isFiniteNumber(value)) return null;
    normalized[index] = value;
  }
  return normalized;
}

export function normalizeMonthsPresent(months) {
  if (!Array.isArray(months)) return null;
  return [...new Set(months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]
    .sort((left, right) => left - right);
}

export function normalizeDashboardData(data) {
  if (!data || typeof data !== 'object' || !data.years || typeof data.years !== 'object') {
    return { valid: false, errors: ['years_missing'], data: null };
  }
  const years = createDictionary();
  const errors = [];
  Object.keys(data.years).sort().forEach((yearKey) => {
    const sourceYear = data.years[yearKey];
    if (!/^\d{4}$/.test(yearKey) || !sourceYear || !sourceYear.monthly || typeof sourceYear.monthly !== 'object') {
      errors.push(`invalid_year:${yearKey}`);
      return;
    }
    const monthly = createDictionary();
    let validYear = true;
    Object.keys(sourceYear.monthly).forEach((key) => {
      const series = normalizeSeries(sourceYear.monthly[key]);
      if (series) monthly[key] = series;
      else { errors.push(`invalid_series:${yearKey}:${key}`); validYear = false; }
    });
    if (!validYear) return;
    years[yearKey] = {
      ...sourceYear,
      monthly,
      months_present: normalizeMonthsPresent(sourceYear.months_present),
    };
  });
  const hasValidYear = Object.keys(years).length > 0;
  if (!hasValidYear) errors.push('no_valid_year');
  return {
    // A normalized cache must never silently omit a malformed year.  Partial
    // years are accepted above; malformed years and series invalidate the
    // complete candidate so the caller can retain its previous cache.
    valid: hasValidYear && errors.length === 0,
    errors,
    data: { ...data, years, labels_missing: Array.isArray(data.labels_missing) ? data.labels_missing.slice() : [] },
  };
}

export function assertValidDashboardData(data) {
  const result = normalizeDashboardData(data);
  if (!result.valid) throw new Error(`Données mémorisées invalides : ${result.errors.join(', ')}`);
  return result.data;
}

export function getMetricSeries(year, key) {
  const series = year && year.monthly && year.monthly[key];
  return Array.isArray(series) ? series : null;
}

export function isPeriodCovered(year, endMonth) {
  if (!year || !Array.isArray(year.months_present)) return false;
  for (let month = 1; month <= endMonth; month += 1) {
    if (!year.months_present.includes(month)) return false;
  }
  return true;
}

export function hasObservedValue(series, startMonth = 1, endMonth = 12) {
  if (!Array.isArray(series)) return false;
  return series.slice(startMonth - 1, endMonth).some(isFiniteNumber);
}

export function hasObservedEveryMonth(series, startMonth = 1, endMonth = 12) {
  if (!Array.isArray(series)) return false;
  for (let index = startMonth - 1; index < endMonth; index += 1) {
    if (!isFiniteNumber(series[index])) return false;
  }
  return true;
}

export function isCompleteHistoricalYear(year) {
  return isPeriodCovered(year, 12) && HISTORICAL_METRICS.every((key) =>
    hasObservedEveryMonth(getMetricSeries(year, key)));
}
