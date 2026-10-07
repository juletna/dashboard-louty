import { validMonth } from '../domain/forecast.js';

export const FORECAST_KEY = 'cabestan_forecast_v1';

export function validateChoice(choice) {
  return choice && ['include', 'exclude'].includes(choice.action) &&
    (choice.advanceKeys === undefined || (Array.isArray(choice.advanceKeys) && choice.advanceKeys.every(key => typeof key === 'string') && new Set(choice.advanceKeys).size === choice.advanceKeys.length)) &&
    typeof choice.fingerprint === 'string' && choice.quote && typeof choice.quote === 'object' &&
    (choice.action === 'exclude' || (['confirmed', 'waiting'].includes(choice.situation) &&
      Number.isFinite(choice.remaining) && choice.remaining >= 0 &&
      (choice.month === null || validMonth(choice.month))));
}

// Independent of the RES cache: refreshing RES clears complementary imports,
// but must never destroy a user's manually entered forecast decisions.
export function createForecastStorage(storage) {
  let choices = new Map();
  let warning = '';
  try {
    const raw = storage.getItem(FORECAST_KEY);
    if (raw !== null) {
      const saved = JSON.parse(raw);
      if (saved.version !== 1 || !Array.isArray(saved.entries) ||
        saved.entries.some(e => !Array.isArray(e) || typeof e[0] !== 'string' || !validateChoice(e[1]))) throw new Error('invalid');
      choices = new Map(saved.entries);
    }
  } catch {
    warning = 'Les choix mémorisés du prévisionnel sont illisibles ou inaccessibles. Le cache existant est conservé.';
  }
  let blocked = !!warning;
  return {
    get choices() { return new Map(choices); },
    get warning() { return warning; },
    set(key, choice) {
      if (choice !== null && !validateChoice(choice)) throw new Error('Prévision invalide.');
      const next = new Map(choices);
      if (choice === null) next.delete(key); else next.set(key, choice);
      choices = next;
      if (blocked) {
        warning = 'Choix utilisables pour cette session seulement : le cache précédent, illisible ou inaccessible, est conservé.';
        return false;
      }
      try {
        storage.setItem(FORECAST_KEY, JSON.stringify({ version: 1, entries: [...choices] }));
        warning = ''; return true;
      } catch {
        warning = 'Choix utilisables pour cette session, mais non mémorisés après rechargement. L’ancien cache est conservé.';
        return false;
      }
    },
  };
}
