// A quick change may reuse a verified manual amount, never an ambiguous quote total.
export const FORECAST_STATES = {
  confirmed: 'À facturer (estimation)',
  waiting: 'En attente client',
  validation: 'En attente de validation',
  review: 'À examiner',
};

export function quickForecastChoice(row, target) {
  if (!row || ![...Object.keys(FORECAST_STATES), 'exclude'].includes(target)) return null;
  const choice = row.choice;
  const quote = { client:row.client, number:row.number, date:row.date, amount:row.amount, title:row.title, activity:row.activity };
  if (target === 'exclude') return { action:'exclude', fingerprint:row.fingerprint ?? choice?.fingerprint, quote };
  if (row.missing || choice?.action !== 'include' || !Number.isFinite(choice.remaining) || choice.remaining < 0) return null;
  if (target === 'review') return { ...choice, reviewRequested:true, quote };
  // A stale reconciliation must still be examined in the editor before reactivation.
  if (row.review) return null;
  return { ...choice, situation:target, reviewRequested:false, quote };
}
