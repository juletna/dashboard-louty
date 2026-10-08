import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const thisFile = fileURLToPath(import.meta.url);
const root = resolve(dirname(thisFile), '../..');

function bundledXlsx() {
  const source = readFileSync(resolve(root, 'src/vendor/xlsx.js'), 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    Buffer,
    Uint8Array,
    ArrayBuffer,
    console,
    setTimeout,
    clearTimeout,
  });
  return module.exports;
}

function appendSheet(XLSX, workbook, name, rows, options = {}) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  if (options.rowLevels) sheet['!rows'] = options.rowLevels;
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function resWorkbook(XLSX) {
  const years = [
    { year: 2024, months: 12, factor: 1 },
    { year: 2025, months: 7, factor: 1.12 },
  ];
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const base = {
    marge_economique: 2900,
    marge_brute: 6300,
    ca: 10500,
    achats_approv: -1100,
    achats_matieres: -4200,
    contribution_coop: -430,
    charges_fonct: -1250,
    remunerations: -1500,
    frais_km: -180,
  };
  const labels = {
    marge_economique: 'Marge économique',
    marge_brute: 'Marge brute',
    ca: "Chiffre d'affaires",
    achats_approv: "Achats d'approvisionnement",
    achats_matieres: '60101000 - Achats stockés - Matières premières',
    contribution_coop: 'Contribution coopérative',
    charges_fonct: 'Charges de fonctionnement',
    remunerations: 'Rémunérations',
    frais_km: '62510150 - Frais Kilométriques',
  };
  const header = ['Poste'];
  const spans = [];
  for (const spec of years) {
    const start = header.length;
    for (let month = 0; month < spec.months; month += 1) header.push(`${months[month]}-${String(spec.year).slice(2)}`);
    const solde = header.length;
    header.push('Solde');
    spans.push({ ...spec, start, solde });
  }
  const rows = [['Export synthétique — aucune donnée réelle'], [], header];
  for (const key of Object.keys(labels)) {
    const row = [labels[key]];
    for (const span of spans) {
      const values = Array.from({ length: span.months }, (_, index) => Math.round(base[key] * span.factor * (1 + index * 0.015) * 100) / 100);
      row.push(...values, values.reduce((sum, value) => sum + value, 0));
    }
    rows.push(row);
    if (key === 'charges_fonct') {
      const details = [
        ['62510150 - Frais kilométriques synthétiques', -180],
        ['60630000 - Fournitures synthétiques', -260],
      ];
      for (const [label, amount] of details) {
        const detail = [label];
        for (const span of spans) {
          const values = Array.from({ length: span.months }, () => amount);
          detail.push(...values, values.reduce((sum, value) => sum + value, 0));
        }
        rows.push(detail);
      }
    }
  }
  const levels = rows.map(() => ({ level: 0 }));
  const chargesIndex = rows.findIndex((row) => row[0] === labels.charges_fonct);
  levels[chargesIndex + 1] = { level: 2 };
  levels[chargesIndex + 2] = { level: 2 };
  const workbook = XLSX.utils.book_new();
  appendSheet(XLSX, workbook, 'Rapport', rows, { rowLevels: levels });
  return workbook;
}

function balanceWorkbook(XLSX) {
  const rows = [
    ['Compte', 'Libellé', '', '', '', 'Solde'],
    ['', '', '', new Date('2025-07-31T12:00:00'), '', ''],
    ['41100000', 'Créances clients synthétiques', '', '', '', 8400],
    ['44571101', 'TVA collectée synthétique', '', '', '', -1500],
    ['44566000', 'TVA déductible synthétique', '', '', '', 320],
    ['51200000', 'Banque fictive', '', '', '', 21200],
    ['40100000', 'Fournisseurs synthétiques', '', '', '', -2900],
    ['43100000', 'Charges sociales synthétiques', '', '', '', -1200],
    ['41910000', 'Acomptes clients synthétiques', '', '', '', -800],
    ['45500000', 'Compte associé synthétique', '', '', '', -2000],
  ];
  const workbook = XLSX.utils.book_new();
  appendSheet(XLSX, workbook, 'Rapport', rows);
  return workbook;
}

function piecesWorkbook(XLSX) {
  const rows = [
    ['Type', 'Date', 'Client', 'Montant H.T.', 'Etat', 'Déjà réglé', 'En attente', 'Date échéance', 'Numéro chrono'],
    ['Devis', '2024-02-12', 'Client Fictif Alpha', 1800, 'Validé + Imprimé', 0, 0, '', 'DEV-001'],
    ['Devis', '2024-06-03', 'Client Fictif Bravo', 7600, 'Validé + Imprimé', 0, 0, '', 'DEV-002'],
    ['Facture', '2025-02-10', 'Client Fictif Alpha', 5400, 'Confirmé', 2400, 3000, '2025-03-12', 'FAC-001'],
    ['Facture de situation', '2025-04-15', 'Client Fictif Bravo', 12400, 'Confirmé', 12400, 0, '2025-05-15', 'FAC-002'],
    ["Facture d'acompte", '2025-05-20', 'Client Fictif Charlie', 2200, 'Confirmé', 2200, 0, '', 'ACO-001'],
    ['Avoir', '2025-06-01', 'Client Fictif Alpha', -500, 'Confirmé', 0, 0, '', 'AVO-001'],
    ['Devis', '2025-06-04', 'Client Fictif Ignoré', 3000, 'Brouillon', 0, 0, '', 'DEV-003'],
  ];
  const workbook = XLSX.utils.book_new();
  appendSheet(XLSX, workbook, 'Pièces synthétiques', rows);
  return workbook;
}

function invalidPiecesWorkbook(XLSX) {
  const workbook = XLSX.utils.book_new();
  appendSheet(XLSX, workbook, 'Pièces incomplètes', [
    ['Type', 'Date', 'Client', 'Montant H.T.'],
    ['Facture', new Date('2025-06-01'), 'Client Fictif Invalide', 100],
  ]);
  return workbook;
}

function writeWorkbook(XLSX, workbook, path) {
  writeFileSync(path, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', cellDates: true }));
}

export function createForecastFixtureFiles(directory) {
  const files = createFixtureFiles(directory);
  const XLSX = bundledXlsx();
  const header = ['Type', 'Date', 'Client', 'Montant H.T.', 'Etat', 'N° client', 'Numéro chrono', 'Titre', 'Code activité'];
  const rows = [header,
    ['Devis','2025-06-01','Client Test Manuel',2100,'Validé & imp.','001','DEV-MANUAL','Luminaires','ACT'],
    ['Facture','2025-07-01','Client Test Manuel',2100,'Confirmé','001','FAC-MANUAL','Luminaires','ACT'],
    ['Devis','2025-06-02','Client Test Partiel',5800,'Attente valid.','','DEV-PARTIAL','Extension','ACT'],
    ['Facture de situation','2025-07-02','Client Test Partiel',1700,'Confirmé','002','FAC-PARTIAL','Situation','ACT'],
    ['Devis','2025-06-03','Client Test Sans ID',3200,'Attente valid.','','DEV-NO-ID','Tableau','ACT'],
    ['Devis','2025-06-03','Client Brouillon',900,'Brouillon','003','DEV-DRAFT','Brouillon','ACT'],
    ['Devis','2025-06-03','<img src=x onerror=alert(1)>',900,'Validé & imp.','004','DEV-XSS','Titre <script>','ACT'],
  ];
  for (const [name, more] of [['forecast', []], ['changed', [['Facture','2025-08-10','Client Test Partiel',400,'Confirmé','002','FAC-NEW','Nouvelle facture','ACT']]]]) {
    const book = XLSX.utils.book_new();
    appendSheet(XLSX, book, 'Pièces fictives', rows.concat(more));
    files[name] = resolve(directory, `Pieces_${name}_250815_120000.xlsx`);
    writeWorkbook(XLSX, book, files[name]);
  }
  return files;
}

export function createFixtureFiles(directory) {
  mkdirSync(directory, { recursive: true });
  const XLSX = bundledXlsx();
  const files = {
    res: resolve(directory, 'RES_U_Resultat_Activite_250731_120000.xlsx'),
    bal: resolve(directory, 'BAL_A_Balance_Analytique_250731_120001.xlsx'),
    pieces: resolve(directory, 'Pieces_250731_120002.xlsx'),
    invalid: resolve(directory, 'Pieces_invalide_250731_120003.xlsx'),
  };
  writeWorkbook(XLSX, resWorkbook(XLSX), files.res);
  writeWorkbook(XLSX, balanceWorkbook(XLSX), files.bal);
  writeWorkbook(XLSX, piecesWorkbook(XLSX), files.pieces);
  writeWorkbook(XLSX, invalidPiecesWorkbook(XLSX), files.invalid);
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  const destination = resolve(process.argv[2] || 'test/fixtures/generated');
  const files = createFixtureFiles(destination);
  process.stdout.write(`${Object.values(files).join('\n')}\n`);
}

export function createAcceptedFixtureFiles(directory) {
  const files = createFixtureFiles(directory), X = bundledXlsx();
  const header = ['Type','Date','Client','Montant H.T.','Etat','N° client','Numéro chrono','Titre','Code activité','Montant T.T.C.','Déjà réglé','En attente','Date accord'];
  const q = (number, amount, client, date = '2025-06-01', agreement = '2025-06-02') => ['Devis',date,client,amount,'Validé & imp.',client,number,'Chantier fictif','ACT',amount*1.2,null,null,agreement];
  const f = (number, amount, client, type = 'Facture', paid = amount*1.2) => [type,'2025-07-01',client,amount,'Confirmé',client,number,'Facture fictive','ACT',amount*1.2,paid,amount*1.2-paid,null];
  const rows = [header,q('AUTO',1000,'Client Automatique'),q('PART',2000,'Client Partiel'),f('INV-PART',500,'Client Partiel','Facture de situation'),
    q('REPEAT-1',100,'Client Répété'),q('REPEAT-2',100,'Client Répété'),f('INV-1',100,'Client Répété'),f('INV-2',100,'Client Répété'),
    q('ADV',3000,'Client Acompte'),q('ADV-OTHER',4000,'Client Acompte'),f('DEP',900,'Client Acompte',"Facture d'acompte"),
    q('OLD',600,'Client Ancien','2024-06-01',null),
    ['Devis','2025-06-01','Cliente TTC',90,'Validé & imp.','ID-A','Q-TTC','Chantier TVA','ACT',99,0,0,'2025-06-01'],
    ['Facture','2025-06-08','Cliente TTC',82.5,'Confirmé','ID-B','F-TTC','Facture TVA','ACT',99,99,0,null]];
  for (const [key, paid] of [['accepted',1080],['unpaid',0]]) {
    const copy = rows.map(r => [...r]);
    const deposit = copy.find(r=>r[6]==='DEP'); deposit[10] = paid; deposit[11] = 1080-paid;
    const book = X.utils.book_new(); appendSheet(X,book,'Pièces fictives',copy);
    files[key]=resolve(directory,`Pieces_${key}_250815_120000.xlsx`); writeWorkbook(X,book,files[key]);
  }
  const balance = balanceWorkbook(X); const sheet=balance.Sheets.Rapport;
  const range=X.utils.decode_range(sheet['!ref']);
  for(let r=0;r<=range.e.r;r++) if(sheet[X.utils.encode_cell({r,c:0})]?.v==='41910000') sheet[X.utils.encode_cell({r,c:5})].v=0;
  files.zeroBal=resolve(directory,'BAL_A_Zero_250731_120000.xlsx'); writeWorkbook(X,balance,files.zeroBal);
  return files;
}

export function createBillingFixtureFiles(directory) {
  const files=createFixtureFiles(directory), X=bundledXlsx();
  const header=['Type','Date','Client','Montant H.T.','Etat','N° client','Numéro chrono','Titre','Code activité','Montant T.T.C.','Déjà réglé','En attente','Date accord'];
  const d=(number,type,amount,ttc,client,paid=0,agreement='2025-06-02')=>[type,type==='Devis'?'2025-06-01':'2025-07-01',client,amount,type==='Devis'?'Validé & imp.':'Confirmé',client,number,'Pièce de test fictive','ACT',ttc,paid,ttc-paid,type==='Devis'?agreement:null];
  const rows=[header,d('Q-DEPOSIT','Devis',100,120,'Client Dépôt'),d('DEP',"Facture d'acompte",25,30,'Client Dépôt',30),
    d('Q-PROGRESS','Devis',200,240,'Client Situation'),d('S','Facture de situation',50,60,'Client Situation'),d('AS',"Facture d'acompte",20,24,'Client Situation',24),
    d('Q-SCOPE','Devis',300,360,'Client Périmètre'),d('FS','Facture',270,324,'Client Périmètre'),
    d('Q-COVERED','Devis',100,120,'Client Couvert'),d('FC','Facture',90,120,'Client Couvert'),
    d('Q-WAIT','Devis',70,84,'Client Attente',0,null),
    ['Devis','2025-06-01','Client Validation',80,'Attente valid.','V1','Q-VALIDATION','Pièce fictive','ACT',96,0,0,null],
    ['Devis','2025-06-01','Client Validation sans numéro',30,'Attente valid.','V2','','Pièce fictive','ACT',36,0,0,null]];
  const book=X.utils.book_new();appendSheet(X,book,'Pièces fictives',rows);
  files.billing=resolve(directory,'Pieces_billing_250815_120000.xlsx');writeWorkbook(X,book,files.billing);
  return files;
}
