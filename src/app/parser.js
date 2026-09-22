import { createDictionary } from './domain/schema.js';

/* Parser CABESTAN (portage _parser.py) */
/* ===================================================================
   Parser CABESTAN — portage JS fidèle de _parser.py
   Lit RES.xlsx (feuille "Rapport") + BAL.xlsx (optionnel) via SheetJS.
   Schéma de sortie identique à EMBEDDED_DATA (years{}, sante{}, ...).
   =================================================================== */
export const TARGET_LABELS = {
    marge_economique: "Marge économique",
    marge_brute: "Marge brute",
    ca: "Chiffre d'affaires",
    achats_approv: "Achats d'approvisionnement",
    achats_matieres: "60101000 - Achats stockés - Matières premières",
    contribution_coop: "Contribution coopérative",
    charges_fonct: "Charges de fonctionnement",
    remunerations: "Rémunérations",
    frais_km: "62510150 - Frais Kilométriques"
  };
const TARGET_KEYS = Object.keys(TARGET_LABELS);
export const POSITIVE_AS_ABS = {
    achats_approv: 1, achats_matieres: 1, contribution_coop: 1,
    charges_fonct: 1, remunerations: 1, frais_km: 1
  };
const MONTH_MAP = { janv: 1, "févr": 2, mars: 3, avr: 4, mai: 5, juin: 6,
                    juil: 7, "août": 8, sept: 9, oct: 10, nov: 11, "déc": 12 };
  // motif ^(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?-(\d{2})$
const MONTH_RE = /^(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?-(\d{2})$/i;

  // Construit une matrice dense (lignes x colonnes) équivalente à
  // openpyxl ws.iter_rows(values_only=True) : cellule vide => null.
export function sheetToMatrix(XLSX, ws) {
    if (!ws || !ws['!ref']) return [];
    var range = XLSX.utils.decode_range(ws['!ref']);
    var maxR = range.e.r, maxC = range.e.c;
    var rows = [];
    for (var r = 0; r <= maxR; r++) {
      var row = [];
      for (var c = 0; c <= maxC; c++) {
        var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
        row.push(cell && cell.v !== undefined ? cell.v : null);
      }
      rows.push(row);
    }
    return rows;
  }

  // Équivalent de float(v) or None
export function toFloat(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') {
      var s = v.trim();
      if (s === '') return null;
      var n = Number(s.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.')); // tolère "1 234,56" (espaces/insécables)
      return isFinite(n) ? n : null;
    }
    return null;
  }

  // Détail : comptes de niveau 3 sous une ligne de catégorie, via les niveaux
  // de regroupement (outline) exposés par SheetJS dans ws['!rows'][r].level.
  function extractChargesDetail(ws, rows, curCols, cfRowIdx) {
    var out = [];
    var meta = ws && ws['!rows'];
    if (!meta || cfRowIdx === null || cfRowIdx === undefined) return out;
    var lvlOf = function (r) { var m = meta[r]; return (m && typeof m.level === 'number') ? m.level : 0; };
    var base = lvlOf(cfRowIdx);
    for (var r = cfRowIdx + 1; r < rows.length; r++) {
      var lv = lvlOf(r);
      if (lv !== 0 && lv <= base) break;   // prochaine catégorie de niveau ≤ base
      if (lv !== base + 2) continue;       // ne garder que les comptes (niveau L3)
      var raw = rows[r][0];
      var s = (raw === null || raw === undefined) ? '' : String(raw).trim();
      if (!s) continue;
      var mm = /^(\d{6,8})\s*-\s*(.*)$/.exec(s);
      var sum = 0;
      for (var ci = 0; ci < curCols.length; ci++) { var v = toFloat(rows[r][curCols[ci]]); if (v !== null) sum += v; }
      var amt = Math.abs(sum);
      if (amt > 0.5) out.push({ account: mm ? mm[1] : '', label: mm ? mm[2].trim() : s, amount: Math.round(amt * 100) / 100 });
    }
    out.sort(function (a, b) { return b.amount - a.amount; });
    return out;
  }

export function parseRES(XLSX, workbookOrRows) {
    var rows, wsRef = null;
    if (Array.isArray(workbookOrRows)) {
      rows = workbookOrRows;
    } else {
      var wb = workbookOrRows;
      if (wb.SheetNames.indexOf('Rapport') === -1) {
        throw new Error("Feuille 'Rapport' introuvable. Feuilles : " + wb.SheetNames.join(', '));
      }
      wsRef = wb.Sheets['Rapport'];
      rows = sheetToMatrix(XLSX, wsRef);
    }
    if (rows.length < 4) throw new Error('Fichier trop court');

    var header = rows[2]; // 3e ligne (index 2)
    var yearsData = createDictionary();   // year -> { months:[[colIdx,monthNum]], solde_col }
    var currentYear = null;
    for (var col = 0; col < header.length; col++) {
      var val = header[col];
      if (val === null || val === undefined) continue;
      var s = String(val).trim();
      var m = MONTH_RE.exec(s);
      if (m) {
        var year = 2000 + parseInt(m[2], 10);
        var monthNum = MONTH_MAP[m[1].toLowerCase()];
        if (!yearsData[year]) yearsData[year] = { months: [], solde_col: null };
        yearsData[year].months.push([col, monthNum]);
        currentYear = year;
      } else if (s.toLowerCase() === 'solde' && currentYear !== null) {
        yearsData[currentYear].solde_col = col;
        currentYear = null;
      }
    }

    // Localise la ligne de chaque poste cible (égalité stricte après strip)
    var labelToRow = createDictionary();
    for (var i = 0; i < rows.length; i++) {
      var lbl = rows[i][0];
      if (lbl && typeof lbl === 'string') {
        var stripped = lbl.trim();
        for (var k = 0; k < TARGET_KEYS.length; k++) {
          var key = TARGET_KEYS[k];
          if (stripped === TARGET_LABELS[key]) labelToRow[key] = i;
        }
      }
    }

    function gv(r, c) {
      if (r === undefined || r === null || c === undefined || c === null) return null;
      if (r >= rows.length) return null;
      return toFloat(rows[r][c]);
    }

    var labelsMissing = TARGET_KEYS.filter(function (k) { return !(k in labelToRow); });
    var out = { years: createDictionary(), labels_missing: labelsMissing };

    var yearNums = Object.keys(yearsData).map(Number).sort(function (a, b) { return a - b; });
    yearNums.forEach(function (year) {
      var info = yearsData[year];
      var months = info.months;
      var perMetric = createDictionary();
      TARGET_KEYS.forEach(function (key) {
        var arr = new Array(12).fill(null);
        months.forEach(function (pair) {
          var colIdx = pair[0], mNum = pair[1];
          var v = gv(labelToRow[key], colIdx);
          if (v !== null) arr[mNum - 1] = POSITIVE_AS_ABS[key] ? Math.abs(v) : v;
        });
        perMetric[key] = arr;
      });
      var soldes = createDictionary();
      TARGET_KEYS.forEach(function (key) {
        var v = gv(labelToRow[key], info.solde_col);
        soldes[key] = (v !== null) ? (POSITIVE_AS_ABS[key] ? Math.abs(v) : v) : null;
      });
      var monthsPresent = months.map(function (p) { return p[1]; }).sort(function (a, b) { return a - b; });
      out.years[String(year)] = { monthly: perMetric, solde: soldes, months_present: monthsPresent };
    });

    // Détail des charges de fonctionnement (comptes, année courante)
    out.charges_detail = [];
    try {
      if (wsRef && ('charges_fonct' in labelToRow) && yearNums.length) {
        var _cy = yearNums[yearNums.length - 1];
        var _cols = (yearsData[_cy] && yearsData[_cy].months) ? yearsData[_cy].months.map(function (p) { return p[0]; }) : [];
        out.charges_detail = extractChargesDetail(wsRef, rows, _cols, labelToRow['charges_fonct']);
      }
    } catch (e) { /* détail optionnel */ }
    return out;
  }

  function r2(x) { return Math.round(x * 100) / 100; }

export function parseBAL(XLSX, workbook) {
    var ws = workbook.Sheets['Rapport'];
    if (!ws) throw new Error("Feuille 'Rapport' introuvable dans le fichier balance.");
    var rows = sheetToMatrix(XLSX, ws);
    var data = createDictionary();
    for (var i = 0; i < rows.length; i++) {
      if (i === 0) continue; // en-tête
      var row = rows[i];
      var cells = (row.concat([null, null, null, null, null, null])).slice(0, 6);
      var num = cells[0], lib = cells[1], solde = cells[5];
      if (num === null || num === undefined || solde === null || solde === undefined) continue;
      num = String(num).trim();
      var s = toFloat(solde);
      if (s === null) continue;
      data[num] = { lib: lib ? String(lib).trim() : '', solde: s };
    }

    function g(k) { return (data[k] && typeof data[k].solde === 'number') ? data[k].solde : 0; }

    var creances = g('41100000');
    var tvaCollectee = g('44571101') + g('44571200') + g('44571701');
    var tvaDeductible = g('44566000');
    var tvaAPayer = -tvaCollectee - tvaDeductible;

    var banques = [];
    Object.keys(data).forEach(function (k) {
      if (k.indexOf('512') === 0) banques.push([k, data[k].lib, data[k].solde]);
    });
    var tresorerie = banques.reduce(function (a, b) { return a + b[2]; }, 0);

    var immoBrut = 0, amort = 0;
    Object.keys(data).forEach(function (k) {
      if (k.indexOf('2') === 0 && k.indexOf('28') !== 0) immoBrut += data[k].solde;
      if (k.indexOf('28') === 0) amort += data[k].solde;
    });
    var ccass = g('45500000');

    function sumPref(prefixes) {
      var t = 0;
      Object.keys(data).forEach(function (k) {
        for (var p = 0; p < prefixes.length; p++) {
          if (k.indexOf(prefixes[p]) === 0) { t += data[k].solde; break; }
        }
      });
      return t;
    }
    function owed(x) { return Math.max(0, -x); }

    var dTva = Math.max(0, tvaAPayer);
    var dAcomptes = owed(sumPref(['4191', '4712']));
    var dFourn = owed(sumPref(['40']));
    var dSocial = owed(sumPref(['42', '43']) + g('44551000'));
    var dCca = owed(ccass);
    var dettesTotales = dTva + dAcomptes + dFourn + dSocial + dCca;
    var positionNette = tresorerie - dettesTotales;

    // Date de fin de balance : ligne 2 (index 1), colonne "au" (index 3)
    var dateFin = null;
    try {
      var r1 = rows[1];
      if (r1 && r1[3] instanceof Date) {
        var d = r1[3];
        var pad = function (n) { return (n < 10 ? '0' : '') + n; };
        dateFin = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                  'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      }
    } catch (e) { /* ignore */ }

    return {
      as_of: dateFin,
      creances_clients: r2(creances),
      tva_collectee: r2(-tvaCollectee),
      tva_deductible: r2(tvaDeductible),
      tva_a_payer: r2(tvaAPayer),
      tresorerie_totale: r2(tresorerie),
      banques: banques.map(function (b) {
        return { num: b[0], libelle: String(b[1]).slice(0, 40), solde: r2(b[2]) };
      }),
      immobilisations_nettes: r2(immoBrut + amort),
      comptes_courants_associes: r2(ccass),
      dettes_tva: r2(dTva),
      dettes_acomptes_clients: r2(dAcomptes),
      dettes_fournisseurs: r2(dFourn),
      dettes_sociales_fiscales: r2(dSocial),
      dettes_cca: r2(dCca),
      dettes_totales: r2(dettesTotales),
      position_nette: r2(positionNette)
    };
  }

  // Export « Gestion com. > Devis (liste) ». Les règles évitent les brouillons,
  // les devis non aboutis et le double comptage potentiel des factures d'acompte.
export function parsePieces(XLSX, workbook) {
    var ws = null;
    for (var si = 0; si < workbook.SheetNames.length; si++) {
      var candidate = workbook.Sheets[workbook.SheetNames[si]];
      var probe = sheetToMatrix(XLSX, candidate)[0] || [];
      var names = probe.map(function (v) { return String(v == null ? '' : v).trim(); });
      if (names.indexOf('Type') !== -1 && names.indexOf('Date') !== -1 && names.indexOf('Client') !== -1 && names.indexOf('Montant H.T.') !== -1 && names.indexOf('Etat') !== -1) { ws = candidate; break; }
    }
    if (!ws) throw new Error('Export Pièces illisible : colonnes Type, Date, Client, Montant H.T. et Etat introuvables.');
    var rows = sheetToMatrix(XLSX, ws);
    var header = rows[0] || [], col = createDictionary();
    header.forEach(function (v, i) { col[String(v == null ? '' : v).trim()] = i; });
    var quoteByYear = createDictionary(), clientByYear = createDictionary(), quoteCoverage = createDictionary(), advancesByClient = createDictionary(), receivablesByClient = createDictionary();
    function add(map, year, label, amount) {
      if (!map[year]) map[year] = createDictionary();
      map[year][label] = (map[year][label] || 0) + amount;
    }
    function dateOf(v) { return parsePiecesDate(v); }
    function quoteBucket(amount) {
      if (amount < 2000) return '< 2 k€';
      if (amount < 5000) return '2–5 k€';
      if (amount < 10000) return '5–10 k€';
      if (amount < 25000) return '10–25 k€';
      return '> 25 k€';
    }
    function addCustomerDetail(map, clientName, amount, date, dueDate, number) {
      if (!map[clientName]) map[clientName] = { client: clientName, amount: 0, documents: [] };
      map[clientName].amount += amount;
      map[clientName].documents.push({ amount: Math.round(amount * 100) / 100, date: date ? date.toISOString() : null, due_date: dueDate ? dueDate.toISOString() : null, number: number || '' });
    }
    for (var r = 1; r < rows.length; r++) {
      var row = rows[r], type = String(row[col.Type] == null ? '' : row[col.Type]).trim();
      var state = String(row[col.Etat] == null ? '' : row[col.Etat]).toLocaleLowerCase('fr-FR');
      var client = String(row[col.Client] == null ? '' : row[col.Client]).trim();
      var amount = toFloat(row[col['Montant H.T.']]), date = dateOf(row[col.Date]);
      if (!date || amount === null || !client) continue;
      var year = String(date.getFullYear());
      if (type === 'Devis' && state.indexOf('valid') !== -1 && state.indexOf('imp') !== -1 && amount > 0) {
        add(quoteByYear, year, quoteBucket(amount), amount);
        var month = date.getMonth() + 1;
        if (!quoteCoverage[year]) quoteCoverage[year] = { first_month: month, last_month: month };
        else { quoteCoverage[year].first_month = Math.min(quoteCoverage[year].first_month, month); quoteCoverage[year].last_month = Math.max(quoteCoverage[year].last_month, month); }
      }
      if ((type === 'Facture' || type === 'Facture de situation' || type === 'Avoir') && state.indexOf('confirm') !== -1) {
        add(clientByYear, year, client, amount);
      }
      if (state.indexOf('confirm') !== -1) {
        var paid = toFloat(row[col['Déjà réglé']]) || 0;
        var pending = toFloat(row[col['En attente']]) || 0;
        var dueDate = dateOf(row[col['Date échéance']]);
        var number = String(row[col['Numéro chrono']] == null ? '' : row[col['Numéro chrono']]).trim();
        // Les acomptes restent exclus du CA, mais servent au rapprochement de la dette 4191.
        if (type === "Facture d'acompte" && paid > 0) addCustomerDetail(advancesByClient, client, paid, date, null, number);
        // Le solde « En attente » est la donnée de relance : les trop-perçus restent volontairement exclus.
        if ((type === 'Facture' || type === 'Facture de situation') && pending > 0) addCustomerDetail(receivablesByClient, client, pending, date, dueDate, number);
      }
    }
    function orderedQuotes(values) {
      var labels = ['< 2 k€', '2–5 k€', '5–10 k€', '10–25 k€', '> 25 k€'];
      return labels.map(function (label) { return { label: label, amount: Math.round((values[label] || 0) * 100) / 100 }; }).filter(function (r) { return r.amount > 0; });
    }
    var byYear = createDictionary(), years = createDictionary();
    Object.keys(quoteByYear).concat(Object.keys(clientByYear)).forEach(function (year) { years[year] = true; });
    Object.keys(years).forEach(function (year) {
      byYear[year] = {
        quote_brackets: orderedQuotes(quoteByYear[year] || {}),
        quote_coverage: quoteCoverage[year] || null,
        clients: Object.keys(clientByYear[year] || {}).map(function (label) { return { label: label, amount: Math.round(clientByYear[year][label] * 100) / 100 }; }).filter(function (r) { return r.amount > 0; })
      };
    });
    function detailList(map) {
      return Object.keys(map).map(function (clientName) {
        var item = map[clientName];
        item.amount = Math.round(item.amount * 100) / 100;
        item.documents.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
        return item;
      }).sort(function (a, b) { return b.amount - a.amount; });
    }
    return { by_year: byYear, payment_details: { advances: detailList(advancesByClient), receivables: detailList(receivablesByClient) } };
  }

export function parsePiecesDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const API = { TARGET_LABELS, POSITIVE_AS_ABS, sheetToMatrix, toFloat, parseRES, parseBAL, parsePieces, parsePiecesDate };
if (typeof window !== 'undefined') window.CabestanParser = API;
