const DEPENDENT_IMPORT_KEYS = [
  'revenue_distribution', 'margin_distribution', 'mb_distribution',
  'sante', 'sante_error', 'bal_name', 'pieces_name',
  'bal_export_iso', 'pieces_export_iso',
];

export function readWorkbook(file, XLSX, Reader = FileReader) {
  return new Promise((resolve, reject) => {
    const reader = new Reader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array', cellDates: true, cellStyles: true });
        resolve({ name: file.name, wb });
      } catch (error) {
        reject(new Error(`Impossible de lire « ${file.name} » : fichier Excel invalide.`, { cause: error }));
      }
    };
    reader.onerror = () => reject(new Error(`Lecture impossible de « ${file.name} ».`));
    reader.readAsArrayBuffer(file);
  });
}

export function parseExportDate(name) {
  const match = /_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.xlsx$/i.exec(name || '');
  if (!match) return null;
  const date = new Date(2000 + (+match[1]), (+match[2]) - 1, +match[3], +match[4], +match[5], +match[6]);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function resetDependentImports(data) {
  for (const key of DEPENDENT_IMPORT_KEYS) delete data[key];
  return data;
}

function parseOptional(candidate, book, parse, field, nameField, dateField, label) {
  if (!book) return;
  try {
    candidate[field] = parse(book.wb);
  } catch (error) {
    throw new Error(`${label} illisible : ${error.message}`, { cause: error });
  }
  candidate[nameField] = book.name;
  candidate[dateField] = parseExportDate(book.name);
}

// All parsers receive a workbook and must return new data without mutating priorData.
export function prepareImportCandidate(classified, priorData, parsers, now = () => new Date()) {
  const { resBook, balBook, piecesBook } = classified;
  if (!resBook && !balBook && !piecesBook) {
    throw new Error("Commence par déposer le fichier Résultat d'Activité (RES_U_Résultat d'Activité).");
  }
  let candidate;
  if (resBook) {
    candidate = resetDependentImports(parsers.parseRES(resBook.wb));
    if (!candidate.years || !Object.keys(candidate.years).length) {
      throw new Error("Le fichier Résultat d'Activité ne contient aucune année exploitable.");
    }
    candidate.file_mtime_iso = now().toISOString();
    candidate.res_name = resBook.name;
    candidate.res_export_iso = parseExportDate(resBook.name);
  } else {
    if (!priorData) {
      throw new Error("Commence par déposer le fichier Résultat d'Activité (RES_U_Résultat d'Activité). La Balance ou les Pièces seules ne suffisent pas à générer le tableau de bord.");
    }
    candidate = structuredClone(priorData);
  }
  parseOptional(candidate, balBook, parsers.parseBAL, 'sante', 'bal_name', 'bal_export_iso', 'Balance');
  if (balBook) delete candidate.sante_error;
  parseOptional(candidate, piecesBook, parsers.parsePieces, 'revenue_distribution', 'pieces_name', 'pieces_export_iso', 'Pièces');
  return candidate;
}

export async function publishImportCandidate({ candidate, validate, derive, render, capture, restore, store, persistence, onWarning }) {
  const previous = store.getState();
  let snapshot;
  let renderStarted = false;
  try {
    candidate = validate ? (validate(candidate) || candidate) : candidate;
    snapshot = capture();
    renderStarted = true;
    const derived = derive(candidate);
    await render(candidate, derived);
  } catch (error) {
    let rollbackError = null;
    if (renderStarted) {
      try { await restore(snapshot, previous); }
      catch (failure) { rollbackError = failure; }
    }
    return { ok: false, error, rollbackError };
  }
  store.replaceData(candidate);
  const saved = persistence.saveData(candidate);
  if (!saved.ok) {
    if (onWarning) onWarning('Les données restent utilisables pour cette session, mais ne seront pas mémorisées après rechargement.', saved.error);
    return { ok: true, persisted: false, error: saved.error };
  }
  return { ok: true, persisted: true };
}

export function createImportController({ readBook, classifyBooks, parsers, validate, derive, render, capture, restore, store, persistence, onWarning, now }) {
  let latestRequest = 0;
  return {
    async ingest(fileList) {
      const files = Array.from(fileList).filter((file) => /\.xlsx$/i.test(file.name));
      if (!files.length) throw new Error("Dépose un fichier .xlsx (l'export Louty).");
      const request = ++latestRequest;
      const books = await Promise.all(files.map(readBook));
      if (request !== latestRequest) return { ok: false, superseded: true };
      const classified = classifyBooks(books);
      const candidate = prepareImportCandidate(classified, store.getState().data, parsers, now);
      const outcome = await publishImportCandidate({
        candidate, validate, derive, render, capture, restore, store, persistence, onWarning,
      });
      return { ...outcome, candidate, classified };
    },
  };
}
