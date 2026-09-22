// Keep the existing key and JSON shape so previously saved dashboards remain readable.
export const DATA_KEY = 'cabestan_dashboard_data_v1';
const SAVED_FIELDS = [
  'years', 'labels_missing', 'charges_detail',
  'revenue_distribution', 'margin_distribution', 'mb_distribution',
  'sante', 'sante_error', 'file_mtime_iso', 'res_name', 'bal_name',
  'pieces_name', 'res_export_iso', 'bal_export_iso', 'pieces_export_iso',
];

function savedData(data) {
  return Object.fromEntries(SAVED_FIELDS.map((key) => [key, data[key]]));
}

export function createDataStorage(storage, validate) {
  return {
    loadData() {
      let raw;
      try { raw = storage.getItem(DATA_KEY); }
      catch (error) { return { status: 'unavailable', error }; }
      if (raw === null) return { status: 'empty' };
      try {
        const data = JSON.parse(raw);
        return { status: 'ready', data: validate(data) || data };
      } catch (error) {
        // A read or validation error never removes the user's saved data.
        return { status: 'invalid', error };
      }
    },
    saveData(data) {
      try {
        storage.setItem(DATA_KEY, JSON.stringify(savedData(data)));
        return { ok: true };
      } catch (error) {
        // setItem is atomic: the previous value remains available after failure.
        return { ok: false, error };
      }
    },
  };
}
