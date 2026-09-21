

const MONTH_NAMES = ['Janv','Févr','Mars','Avr','Mai','Juin','Juil','Août','Sept','Oct','Nov','Déc'];
function _computeDark(){var t=document.documentElement.getAttribute('data-theme');if(t==='dark')return true;if(t==='light')return false;return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);}
var DARK = _computeDark();
// Palette chaleureuse unifiée : violet (CA), corail (achats/danger), vert (marge), ambre (ratio/alerte)
const COLORS = {
  red: '#FF6384', orange: '#FF9F40', green: '#4BC0C0', black: '#221F2B',
  blue: '#36A2EB', gray: '#C9CBCF', teal: '#9966FF',
  redA: 'rgba(255,99,132,0.15)', orangeA: 'rgba(255,159,64,0.15)', greenA: 'rgba(75,192,192,0.15)',
};
var CHART_TEXT = DARK ? '#9d97a9' : '#6d6779';
var CHART_GRID = DARK ? 'rgba(255,255,255,0.05)' : 'rgba(40,30,60,0.06)';
var CHART_TOOLTIP_BG = DARK ? '#2a2536' : '#2b2536';
const CHART_FONT = "'Nunito', ui-rounded, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
if (window.Chart) {
  Chart.defaults.font.family = CHART_FONT;
  Chart.defaults.font.size = 12;
  Chart.defaults.font.weight = '600';
  Chart.defaults.color = CHART_TEXT;
  Chart.defaults.borderColor = CHART_GRID;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.padding = 18;
  Chart.defaults.plugins.legend.labels.font = { size: 12, weight: '700' };
  Chart.defaults.plugins.tooltip.backgroundColor = CHART_TOOLTIP_BG;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
  Chart.defaults.plugins.tooltip.bodyColor = 'rgba(255,255,255,0.85)';
  Chart.defaults.plugins.tooltip.titleFont = { size: 12.5, weight: '800', family: CHART_FONT };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 12, weight: '600', family: CHART_FONT };
  Chart.defaults.plugins.tooltip.boxPadding = 6;
  Chart.defaults.plugins.tooltip.usePointStyle = true;
  Chart.defaults.animation.duration = 700;
  Chart.defaults.animation.easing = 'easeOutQuart';
  Chart.defaults.elements.bar.borderRadius = 7;
  Chart.defaults.elements.bar.borderSkipped = false;
  Chart.defaults.elements.point.radius = 2.5;
  Chart.defaults.elements.point.hoverRadius = 6;
  Chart.defaults.elements.line.tension = 0.4;
  Chart.defaults.elements.line.borderJoinStyle = 'round';
  Chart.defaults.elements.line.capBezierPoints = true;
  try {
    if (Chart.defaults.scale) {
      if (Chart.defaults.scale.grid) {
        Chart.defaults.scale.grid.color = CHART_GRID;
        Chart.defaults.scale.grid.drawTicks = false;
        Chart.defaults.scale.grid.tickLength = 8;
      }
      if (Chart.defaults.scale.ticks) Chart.defaults.scale.ticks.padding = 8;
      if (Chart.defaults.scale.border) Chart.defaults.scale.border.display = false;
    }
  } catch (e) { /* défauts d'échelle indisponibles */ }
}

// --- Icônes (pastilles KPI) ---
const _ic = (inner) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
const ICON = {
  wallet: _ic('<path d="M3 7h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/><circle cx="16.5" cy="12.5" r="1.1"/>'),
  receipt: _ic('<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>'),
  percent: _ic('<line x1="19" y1="5" x2="5" y2="19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>'),
  target: _ic('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>'),
  trending: _ic('<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>'),
  gauge: _ic('<path d="M4 15a8 8 0 1 1 16 0"/><line x1="12" y1="15" x2="16" y2="10"/>'),
  cart: _ic('<circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/><path d="M2 3h3l2.4 12.1a1.6 1.6 0 0 0 1.6 1.3h8.5a1.6 1.6 0 0 0 1.6-1.3L22 7H6"/>'),
  ratio: _ic('<circle cx="12" cy="6" r="1.4"/><circle cx="12" cy="18" r="1.4"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  pie: _ic('<path d="M21 12a9 9 0 1 1-9-9v9z"/><path d="M13 3.5a9 9 0 0 1 7.5 7.5H13z"/>'),
  spark: _ic('<path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9z"/>'),
};
const KPI_ICON_MAP = [
  ['Trésorerie','wallet'], ['Créances','receipt'], ['TVA','percent'],
  ['Projection marge','target'], ['Projection CA','trending'], ['Atteinte','gauge'],
  ['Total achats','cart'], ['Ratio achats','ratio'], ['destruction','pie'],
];
function decorateKpis() {
  document.querySelectorAll('.kpi').forEach(k => {
    if (k.querySelector('.kpi-ico')) return;
    const labelEl = k.querySelector('.kpi-label');
    if (!labelEl) return;
    const label = labelEl.textContent || '';
    let name = 'spark';
    for (const [kw, ic] of KPI_ICON_MAP) { if (label.indexOf(kw) !== -1) { name = ic; break; } }
    const top = document.createElement('div');
    top.className = 'kpi-top';
    const chip = document.createElement('span');
    chip.className = 'kpi-ico';
    chip.innerHTML = ICON[name] || ICON.spark;
    labelEl.parentNode.insertBefore(top, labelEl);
    top.appendChild(chip);
    top.appendChild(labelEl);
  });
}
// Couleur d'anneau selon l'atteinte (ratio réel/objectif)
ICON.balance = _ic('<path d="M12 3v18"/><path d="M6 21h12"/><path d="M5 7h14"/><path d="M7 7l-2.5 5a2.5 2.5 0 0 0 5 0z"/><path d="M17 7l-2.5 5a2.5 2.5 0 0 0 5 0z"/>');
ICON.debt = _ic('<circle cx="12" cy="12" r="9"/><line x1="8" y1="12" x2="16" y2="12"/>');
ICON.reserve = _ic('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>');
KPI_ICON_MAP.unshift(['Position', 'balance'], ['Dettes', 'debt'], ['Résultat', 'trending'], ['Compte courant', 'reserve']);

// Constants mirrored from spec
var C = {
  MB_AN_OBJ: 55000, MB_MIN: 3000, MB_OBJ: 4600, MB_EXC: 6000,
  TAUX_DANGER: 0.55, TAUX_OBJ: 0.61, TAUX_EXC: 0.65,
  CA_OBJ: 90000, RATIO_CIBLE: 0.39, RATIO_ALERTE: 0.45,
};

// Échappe toute chaîne issue d'un fichier (nom, libellé, message d'erreur) avant insertion en innerHTML
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmtEUR(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Math.round(v).toLocaleString('fr-FR') + ' €';
}
function fmtPct(v, digits=1) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return (v*100).toFixed(digits).replace('.', ',') + ' %';
}
function fmtDelta(v, suffix='€') {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const sign = v > 0 ? '+' : (v < 0 ? '−' : '±');
  const abs = Math.abs(Math.round(v)).toLocaleString('fr-FR');
  return sign + ' ' + abs + ' ' + suffix;
}
function fmtDeltaPts(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const sign = v > 0 ? '+' : (v < 0 ? '−' : '±');
  return sign + ' ' + Math.abs(v*100).toFixed(1).replace('.',',') + ' pts';
}

// (données injectées dynamiquement par le parser client-side)

function setLoadingMsg(msg) {
  const el = document.getElementById('loading');
  if (el) el.textContent = msg;
}

function computeSnapshot(data) {
  const years = data.years;
  if (!years) return null;
  const yearKeys = Object.keys(years).sort();
  const currentYear = yearKeys[yearKeys.length - 1];
  const currentIdx = yearKeys.indexOf(currentYear);
  const cy = years[currentYear];
  const mb = cy.monthly.marge_brute;
  const ca = cy.monthly.ca;
  const achats = cy.monthly.achats_matieres;
  // Dernier mois renseigné : un mois vide au milieu de l'année ne décale plus les comparaisons "même période"
  const moisRenseignes = mb.reduce((last, v, i) => (v !== null ? i + 1 : last), 0);
  const ytdMB = mb.reduce((a, v) => a + (v || 0), 0);
  const ytdCA = ca.reduce((a, v) => a + (v || 0), 0);
  const ytdAchats = achats.reduce((a, v) => a + (v || 0), 0);
  const tauxMB = ytdCA ? (ytdMB / ytdCA) : null;
  const mbParMois = mb.filter(v => v !== null);
  const achatsParMois = achats.filter(v => v !== null);
  const moisAlerte = mbParMois.filter(v => v < C.MB_MIN).length;
  const projectionNaive = moisRenseignes > 0 ? (ytdMB / moisRenseignes) * 12 : null;

  // === Same-period YTD for prior years ===
  const samePeriod = {}; // { "2025": { mb_ytd, mb_full, ca_ytd, ca_full, achats_ytd, achats_full } }
  for (let i = 0; i < currentIdx; i++) {
    const yk = yearKeys[i];
    const yObj = years[yk];
    const slice = arr => arr.slice(0, moisRenseignes).reduce((a, v) => a + (v || 0), 0);
    const sum = arr => arr.reduce((a, v) => a + (v || 0), 0);
    samePeriod[yk] = {
      mb_ytd: slice(yObj.monthly.marge_brute),
      mb_full: sum(yObj.monthly.marge_brute),
      ca_ytd: slice(yObj.monthly.ca),
      ca_full: sum(yObj.monthly.ca),
      achats_ytd: slice(yObj.monthly.achats_matieres),
      achats_full: sum(yObj.monthly.achats_matieres),
    };
  }

  // === Projection robuste : YTD + moyenne des mois restants sur N-1 + N-2 ===
  // Plus robuste qu'une seule année de référence (atténue une année atypique).
  let projSeasonalMB = null, projSeasonalCA = null, projSeasonalAchats = null;
  let growthRateMB = null, growthRateCA = null;
  let referenceYear = null;
  let referenceYears = [];
  if (currentIdx > 0) {
    // Utiliser jusqu'à 2 années de référence (N-1 et N-2)
    referenceYears = yearKeys.slice(Math.max(0, currentIdx - 2), currentIdx);
    referenceYear = referenceYears[referenceYears.length - 1]; // Le plus récent pour affichage
    // Somme des mois restants (mois moisRenseignes+1 .. 12) moyennée sur les années de réf
    function avgRemainingMonths(key) {
      let totalRemaining = 0, count = 0;
      for (const yk of referenceYears) {
        const arr = years[yk].monthly[key];
        const remaining = arr.slice(moisRenseignes).reduce((a, v) => a + (v || 0), 0);
        totalRemaining += remaining;
        count++;
      }
      return count > 0 ? totalRemaining / count : 0;
    }
    // Croissance vs N-1 (pour affichage)
    const ref = samePeriod[referenceYear];
    if (ref && ref.mb_ytd !== 0) growthRateMB = ytdMB / ref.mb_ytd;
    if (ref && ref.ca_ytd !== 0) growthRateCA = ytdCA / ref.ca_ytd;
    // Projection = YTD réalisé + moyenne des mois restants sur les années de réf
    projSeasonalMB = ytdMB + avgRemainingMonths('marge_brute');
    projSeasonalCA = ytdCA + avgRemainingMonths('ca');
    projSeasonalAchats = ytdAchats + avgRemainingMonths('achats_matieres');
  }

  return {
    year: currentYear,
    ytd_ca: Math.round(ytdCA * 100) / 100,
    ytd_mb: Math.round(ytdMB * 100) / 100,
    ytd_achats: Math.round(ytdAchats * 100) / 100,
    taux_mb: tauxMB !== null ? Math.round(tauxMB * 10000) / 10000 : null,
    mois_renseignes: moisRenseignes,
    mb_par_mois: mbParMois,
    achats_par_mois: achatsParMois,
    mois_alerte: moisAlerte,
    projection_mb_annuelle: projectionNaive !== null ? Math.round(projectionNaive * 100) / 100 : null,
    projection_mb_seasonal: projSeasonalMB !== null ? Math.round(projSeasonalMB * 100) / 100 : null,
    projection_ca_seasonal: projSeasonalCA !== null ? Math.round(projSeasonalCA * 100) / 100 : null,
    projection_achats_seasonal: projSeasonalAchats !== null ? Math.round(projSeasonalAchats * 100) / 100 : null,
    growth_rate_mb: growthRateMB,
    growth_rate_ca: growthRateCA,
    reference_year: referenceYear,
    reference_years: referenceYears,
    same_period: samePeriod,
  };
}
// === FIN LOADDATA ===


let DATA = null;
let charts = {};
let distributionYear = null;
let pilotageMetric = 'mb';

function render(data) {
  DATA = data;
  document.getElementById('loading').style.display = 'none';
  document.getElementById('tab-general').style.display = 'block';
  document.getElementById('tab-achats').style.display = 'block';

  const snap = data.snapshot;
  const cur = snap.current;
  const prev = snap.previous;
  const years = data.years;
  const currentYear = cur.year;
  const cy = years[currentYear];
  const prevYearKey = String(parseInt(currentYear) - 1);
  const py = years[prevYearKey] || null;

  renderAnnualCap(data);
  renderBanner(data, cur, prev);
  renderSante(data, cur);
  renderPerformanceKpis(cy, py, cur);
  renderTableCmp(cy, py, cur);
  renderRepartYears(cur, years);
  renderCAMB(cy, currentYear, years);
  renderTauxAnnuel(cur, years);
  renderCumulChart(years, currentYear, pilotageMetric);
  document.querySelectorAll('[data-pilotage-metric]').forEach(function (button) {
    button.setAttribute('aria-pressed', button.dataset.pilotageMetric === pilotageMetric ? 'true' : 'false');
    button.onclick = function () {
      pilotageMetric = this.dataset.pilotageMetric;
      document.querySelectorAll('[data-pilotage-metric]').forEach(function (item) { item.setAttribute('aria-pressed', item.dataset.pilotageMetric === pilotageMetric ? 'true' : 'false'); });
      renderBanner(data, cur, prev);
      renderCumulChart(years, currentYear, pilotageMetric);
    };
  });
  renderMarginDistributions(data);

  renderAchats(cy, cur);
  renderAchatsCAChart(cy);
  renderTrendChart(years);

  decorateKpis();
}

function makeChart(canvasId, config) {
  if (charts[canvasId]) { charts[canvasId].destroy(); }
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, config);
}

// Répartition optionnelle de CA. Le Résultat d'Activité Louty est agrégé par
// mois ; les deux séries ci-dessous proviennent de l'export détaillé « Pièces ».
// { revenue_distribution: { quote_brackets: [{ label, amount }], clients: [{ label, amount }] } }
function _distributionRows(raw) {
  var rows = [];
  if (Array.isArray(raw)) {
    raw.forEach(function (r) {
      if (!r) return;
      var label = r.label || r.name || r.client || r.bracket || r.tranche;
      var amount = Number(r.amount != null ? r.amount : (r.margin != null ? r.margin : (r.mb != null ? r.mb : r.value)));
      if (label && isFinite(amount) && amount > 0) rows.push({ label: String(label), amount: amount });
    });
  } else if (raw && typeof raw === 'object') {
    Object.keys(raw).forEach(function (label) {
      var amount = Number(raw[label]);
      if (isFinite(amount) && amount > 0) rows.push({ label: label, amount: amount });
    });
  }
  return rows;
}
function _hexAlpha(hex, alpha) {
  var h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
  var n = parseInt(h, 16);
  if (!isFinite(n)) return 'rgba(124,90,214,' + alpha + ')';
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + alpha + ')';
}
function _distributionEmpty(id) {
  var host = document.getElementById(id);
  if (!host) return;
  if (id === 'quote-margin-distribution' && charts['chart-margin-by-quote']) {
    charts['chart-margin-by-quote'].destroy(); delete charts['chart-margin-by-quote'];
  }
  if (id === 'client-margin-distribution' && charts['chart-margin-by-client']) {
    charts['chart-margin-by-client'].destroy(); delete charts['chart-margin-by-client'];
  }
  host.innerHTML = '<div class="distribution-empty">Ajoute l’export détaillé « Pièces » pour afficher cette répartition.</div>';
}
function _distributionPeriodLabel(year, currentYear) {
  return 'Exercice ' + year + (String(year) === String(currentYear) ? ' (à date)' : '');
}
function _wirePiecesUpload() {
  var drop = document.getElementById('pieces-drop');
  var input = document.getElementById('pieces-input');
  var button = document.getElementById('pieces-browse');
  if (!drop || !input || drop.dataset.wired) return;
  drop.dataset.wired = '1';
  button.addEventListener('click', function (e) { e.stopPropagation(); input.click(); });
  drop.addEventListener('click', function (e) { if (e.target !== button) input.click(); });
  input.addEventListener('change', function () { if (input.files.length) ingest(input.files); });
  ['dragenter', 'dragover'].forEach(function (eventName) {
    drop.addEventListener(eventName, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (eventName) {
    drop.addEventListener(eventName, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag'); });
  });
  drop.addEventListener('drop', function (e) { var files = e.dataTransfer && e.dataTransfer.files; if (files && files.length) ingest(files); });
}
function renderMarginDistributions(data) {
  var fullSource = (data && (data.revenue_distribution || data.margin_distribution || data.mb_distribution)) || {};
  var currentYear = data && data.snapshot && data.snapshot.current ? data.snapshot.current.year : null;
  var availableYears = fullSource.by_year ? Object.keys(fullSource.by_year).sort().reverse() : (currentYear ? [String(currentYear)] : []);
  if (!distributionYear || availableYears.indexOf(String(distributionYear)) === -1) distributionYear = String(currentYear || availableYears[0] || '');
  var source = fullSource.by_year ? (fullSource.by_year[distributionYear] || {}) : fullSource;
  var quoteByYear = availableYears.map(function (year) {
    var yearSource = fullSource.by_year ? (fullSource.by_year[year] || {}) : fullSource;
    return { year: year, rows: _distributionRows(yearSource.quote_brackets || yearSource.quotes || yearSource.devis), coverage: yearSource.quote_coverage || null };
  }).filter(function (series) { return series.rows.length; });
  var clientRows = _distributionRows(source.clients || source.by_client);
  var section = document.getElementById('margin-distribution-row');
  var upload = document.getElementById('distribution-upload-row');
  var hasData = quoteByYear.length || clientRows.length;
  if (section) section.style.display = hasData ? '' : 'none';
  if (upload) upload.style.display = hasData ? 'none' : '';
  if (!hasData) { _wirePiecesUpload(); return; }
  var period = document.getElementById('client-distribution-period');
  if (period) {
    var options = availableYears.map(function (year) { return '<option value="' + esc(year) + '"' + (year === distributionYear ? ' selected' : '') + '>' + esc(_distributionPeriodLabel(year, currentYear)) + '</option>'; }).join('');
    period.innerHTML = '<label>Exercice <select id="distribution-year" aria-label="Exercice pour la concentration clients">' + options + '</select></label>';
    var select = document.getElementById('distribution-year');
    select.addEventListener('change', function () {
      distributionYear = this.value;
      var selectedSource = fullSource.by_year ? (fullSource.by_year[distributionYear] || {}) : fullSource;
      renderClientMarginDistribution(_distributionRows(selectedSource.clients || selectedSource.by_client));
    });
  }
  renderQuoteMarginDistribution(quoteByYear, currentYear);
  renderClientMarginDistribution(clientRows);
}
function renderQuoteMarginDistribution(series, currentYear) {
  var host = document.getElementById('quote-margin-distribution');
  if (!host) return;
  if (!series.length) { _distributionEmpty('quote-margin-distribution'); return; }
  host.innerHTML = '<div class="chart-wrap"><canvas id="chart-margin-by-quote"></canvas></div>';
  var violet = getComputedStyle(document.documentElement).getPropertyValue('--violet').trim() || '#7C5AD6';
  var comparisonGray = getComputedStyle(document.documentElement).getPropertyValue('--gray').trim() || '#A7A1B4';
  var bracketOrder = { '< 2 k€': 0, '2–5 k€': 1, '5–10 k€': 2, '10–25 k€': 3, '> 25 k€': 4 };
  var labels = [];
  series.forEach(function (yearSeries) { yearSeries.rows.forEach(function (row) { if (labels.indexOf(row.label) === -1) labels.push(row.label); }); });
  labels.sort(function (a, b) { return (bracketOrder[a] == null ? 99 : bracketOrder[a]) - (bracketOrder[b] == null ? 99 : bracketOrder[b]); });
  var orderedSeries = series.slice().sort(function (a, b) { return String(a.year).localeCompare(String(b.year)); });
  function shares(yearSeries) {
    var total = yearSeries.rows.reduce(function (sum, row) { return sum + row.amount; }, 0) || 1;
    var amounts = {};
    yearSeries.rows.forEach(function (row) { amounts[row.label] = row.amount; });
    return { values: labels.map(function (label) { return (amounts[label] || 0) / total * 100; }), amounts: labels.map(function (label) { return amounts[label] || 0; }) };
  }
  var currentSeries = orderedSeries.filter(function (item) { return String(item.year) === String(currentYear); })[0] || orderedSeries[orderedSeries.length - 1];
  var historical = orderedSeries.filter(function (item) { return String(item.year) < String(currentSeries.year); });
  // Le premier exercice est écarté seulement si l'export montre qu'il a démarré en cours d'année.
  var comparable = historical.filter(function (item, index) { return !(index === 0 && item.coverage && item.coverage.first_month > 1); });
  var current = shares(currentSeries);
  var maxAmount = Math.max.apply(null, current.amounts) || 1;
  var datasets = [{
    type: 'bar', label: _distributionPeriodLabel(currentSeries.year, currentYear), data: current.values, _amounts: current.amounts,
    backgroundColor: current.amounts.map(function (amount) { return _hexAlpha(violet, 0.36 + 0.64 * amount / maxAmount); }),
    borderWidth: 0, borderRadius: 7, borderSkipped: false, order: 2
  }];
  if (comparable.length) {
    var avgValues = labels.map(function (_, labelIndex) { return comparable.reduce(function (sum, item) { return sum + shares(item).values[labelIndex]; }, 0) / comparable.length; });
    var span = comparable.length > 1 ? comparable[0].year + '–' + comparable[comparable.length - 1].year : comparable[0].year;
    datasets.push({
      type: 'line', label: comparable.length > 1 ? 'Moyenne ' + span : 'Exercice ' + span,
      data: avgValues, _average: true, borderColor: comparisonGray, backgroundColor: 'transparent',
      borderDash: [5, 4], borderWidth: 2.5, tension: 0.22, pointRadius: 0, pointHoverRadius: 6, order: 1
    });
  }
  makeChart('chart-margin-by-quote', {
    type: 'bar',
    data: {
      labels: labels, datasets: datasets
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, font: { size: 11, weight: '700' } } },
        y: { beginAtZero: true, ticks: { callback: function (v) { return v + ' %'; } } }
      },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 10, padding: 14, font: { size: 11, weight: '700' } } },
        tooltip: { callbacks: { label: function (ctx) { if (ctx.dataset._average) return ' ' + ctx.dataset.label + ' : ' + ctx.parsed.y.toFixed(1).replace('.', ',') + ' %'; var amount = ctx.dataset._amounts[ctx.dataIndex]; return ' ' + ctx.dataset.label + ' : ' + fmtEUR(amount) + ' (' + ctx.parsed.y.toFixed(1).replace('.', ',') + ' %)'; } } }
      }
    }
  });
}
function renderClientMarginDistribution(rows) {
  var host = document.getElementById('client-margin-distribution');
  if (!host) return;
  if (!rows.length) { _distributionEmpty('client-margin-distribution'); return; }
  rows = rows.slice().sort(function (a, b) { return b.amount - a.amount; });
  if (rows.length > 6) {
    var other = rows.slice(5).reduce(function (sum, row) { return sum + row.amount; }, 0);
    rows = rows.slice(0, 5);
    if (other > 0) rows.push({ label: 'Autres clients', amount: other, other: true });
  }
  var total = rows.reduce(function (sum, row) { return sum + row.amount; }, 0) || 1;
  var cumul = 0;
  var shares = rows.map(function (row) {
    var share = row.amount / total;
    cumul += share;
    return { share:share, cumulative:cumul };
  });
  var accessible = rows.map(function (row, i) {
    return row.label + ' : ' + fmtEUR(row.amount) + ', part ' + fmtPct(shares[i].share, 1) + ', cumul ' + fmtPct(shares[i].cumulative, 1);
  }).join('. ');
  host.innerHTML = '<div class="client-distribution-chart" style="height:' + (rows.length * 40 + 54) + 'px"><canvas id="chart-margin-by-client" role="img" aria-label="' + esc(accessible) + '">' + esc(accessible) + '</canvas></div>';
  var style = getComputedStyle(host);
  var color = function (name) { return style.getPropertyValue(name).trim(); };
  var compact = false;
  makeChart('chart-margin-by-client', {
    type:'bar',
    data:{ labels:rows.map(function (row) { return row.label; }), datasets:[{
      label:'Montant', data:rows.map(function (row) { return row.amount; }),
      backgroundColor:rows.map(function (row, i) { return _hexAlpha(color('--teal'), row.other ? 0.32 : Math.max(0.42, 1 - i * 0.12)); }),
      barThickness:19, borderRadius:6, borderSkipped:false
    }] },
    plugins:[{
      id:'clientDistributionLabels',
      beforeLayout:function (chart) {
        compact = chart.width < 450;
        chart.options.layout.padding.left = compact ? 82 : Math.min(160, chart.width * 0.25);
        chart.options.layout.padding.right = compact ? 88 : 116;
      },
      afterDatasetsDraw:function (chart) {
        var ctx = chart.ctx;
        ctx.save();
        function text(value, x, y, fill, align, size) {
          ctx.font = '700 ' + size + 'px ' + CHART_FONT;
          ctx.fillStyle = fill; ctx.textAlign = align; ctx.fillText(value, x, y);
        }
        var partX = chart.width - (compact ? 47 : 61);
        text('CLIENT', 0, 12, color('--text-faint'), 'left', 10);
        text('PART', partX, 12, color('--text-faint'), 'right', 10);
        text('CUMUL', chart.width, 12, color('--text-faint'), 'right', 10);
        rows.forEach(function (row, i) {
          var y = chart.scales.y.getPixelForValue(i) + 4;
          var size = compact ? 11 : 12.5;
          ctx.font = '700 ' + size + 'px ' + CHART_FONT;
          var label = row.label, maxWidth = chart.chartArea.left - 10;
          if (ctx.measureText(label).width > maxWidth) {
            while (label.length && ctx.measureText(label + '…').width > maxWidth) label = label.slice(0, -1);
            label += '…';
          }
          text(label, 0, y, color('--text'), 'left', size);
          text(Math.round(shares[i].share * 100) + ' %', partX, y, color('--text'), 'right', 11);
          text(Math.round(shares[i].cumulative * 100) + ' %', chart.width, y, color('--text-dim'), 'right', 11);
        });
        ctx.restore();
      }
    }],
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      layout:{ padding:{ top:24, left:100, right:116 } },
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:function (context) {
        var i = context.dataIndex;
        return ['Montant : ' + fmtEUR(rows[i].amount), 'Part : ' + fmtPct(shares[i].share, 1), 'Cumul : ' + fmtPct(shares[i].cumulative, 1)];
      } } } },
      scales:{
        x:{ beginAtZero:true, border:{ display:false }, grid:{ color:color('--border'), drawTicks:false },
          ticks:{ maxTicksLimit:3, maxRotation:0, color:color('--text-faint'), font:{ size:10 }, callback:function (value) { return fmtEUR(value); } } },
        y:{ display:false, offset:true }
      }
    }
  });
}

function renderMonthlyChart(cy, years, curYear) {
  const labels = MONTH_NAMES;
  const mbCyOriginal = cy.monthly.marge_brute;
  const mbCy = mbCyOriginal.map(v => v === null ? 0 : v);
  const ca = cy.monthly.ca;
  const colors = mbCyOriginal.map(v => {
    if (v === null) return COLORS.gray;
    if (v < 0) return COLORS.red;
    if (v < C.MB_MIN) return COLORS.orange;
    return COLORS.green;
  });
  // Moyenne des années précédentes, mois par mois (sur les valeurs disponibles)
  const prevYears = Object.keys(years).filter(y => parseInt(y) < parseInt(curYear)).sort();
  const avgPrev = [];
  for (let m = 0; m < 12; m++) {
    const vals = prevYears.map(y => years[y].monthly.marge_brute[m]).filter(v => v !== null && v !== undefined);
    avgPrev.push(vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null);
  }
  const avgLabel = prevYears.length > 1
    ? 'Moyenne ' + prevYears[0] + '–' + prevYears[prevYears.length - 1]
    : (prevYears.length === 1 ? 'Marge brute ' + prevYears[0] : '');
  const datasets = [
    { type: 'bar', label: 'Marge brute ' + curYear, data: mbCy, backgroundColor: colors, borderColor: colors, borderWidth: 1, order: 2 }
  ];
  if (prevYears.length) {
    datasets.push({
      type: 'line', label: avgLabel, data: avgPrev,
      borderColor: COLORS.gray, backgroundColor: 'transparent',
      borderWidth: 2, pointRadius: 0, pointHoverRadius: 6, tension: 0.4, order: 1, spanGaps: true,
    });
  }
  makeChart('chart-mb', {
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { y: { beginAtZero: true, ticks: { callback: v => fmtEUR(v) } } },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 11 },
            generateLabels: function (chart) {
              var base = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              var extra = [
                { text: 'Seuil salaire brut ' + fmtEUR(C.MB_MIN), strokeStyle: COLORS.black, fillStyle: 'transparent', lineWidth: 2, pointStyle: 'circle', hidden: false, datasetIndex: -1 }
              ];
              return extra.concat(base);
            }
          },
          onClick: function (e, item, legend) {
            if (item.datasetIndex === -1 || item.datasetIndex == null) return;
            var ci = legend.chart, idx = item.datasetIndex;
            if (ci.isDatasetVisible(idx)) ci.hide(idx); else ci.show(idx);
          }
        },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              if (ctx.datasetIndex !== 0) return '';
              const m = ctx.dataIndex;
              const caVal = ca[m];
              const mbVal = mbCyOriginal[m];
              const taux = (caVal && mbVal) ? (mbVal / caVal) : null;
              const lines = [];
              lines.push('CA: ' + fmtEUR(caVal));
              lines.push('Taux MB: ' + fmtPct(taux));
              if (avgPrev[m] !== null && avgPrev[m] !== undefined) lines.push(avgLabel + ': ' + fmtEUR(avgPrev[m]));
              return lines;
            }
          }
        },
      },
    },
    plugins: [{
      id: 'thresholdLines',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: { left, right }, scales: { y } } = chart;
        ctx.save();
        ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.font = '10px sans-serif';
        ctx.strokeStyle = COLORS.black;
        let yMin = y.getPixelForValue(C.MB_MIN);
        ctx.beginPath(); ctx.moveTo(left, yMin); ctx.lineTo(right, yMin); ctx.stroke();
        ctx.restore();
      }
    }],
  });
}
// Graphe fusionné : CA mensuel en barres empilées avec repères historiques discrets en arrière-plan.
function renderCAMB(cy, curYear, years) {
  const labels = MONTH_NAMES;
  const caArr = cy.monthly.ca;
  const mbArr = cy.monthly.marge_brute;
  const mb = caArr.map((c, i) => (c === null && mbArr[i] === null) ? null : (mbArr[i] === null ? 0 : mbArr[i]));
  const reste = caArr.map((c, i) => {
    if (c === null && mbArr[i] === null) return null;
    const cv = c === null ? 0 : c, mv = mbArr[i] === null ? 0 : mbArr[i];
    return Math.max(0, cv - mv);
  });
  const prevYears = Object.keys(years).filter(y => parseInt(y) < parseInt(curYear)).sort();
  const avgOf = key => {
    const out = [];
    for (let m = 0; m < 12; m++) {
      const vals = prevYears.map(y => years[y].monthly[key][m]).filter(v => v !== null && v !== undefined);
      out.push(vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null);
    }
    return out;
  };
  const avgCA = avgOf('ca');
  const avgMB = avgOf('marge_brute');
  const yrSpan = prevYears.length > 1 ? (prevYears[0] + '–' + prevYears[prevYears.length - 1]) : (prevYears[0] || '');
  const avgLabel = prevYears.length > 1 ? 'Moyenne CA ' + yrSpan : (prevYears.length === 1 ? 'CA ' + yrSpan : '');
  const avgLabelMB = prevYears.length > 1 ? 'Moyenne MB ' + yrSpan : (prevYears.length === 1 ? 'MB ' + yrSpan : '');
  // Trajectoire vers les objectifs annuels : elle sert uniquement de guide pour le mois exporté en cours.
  // Le taux de MB est celui implicite dans les objectifs (MB annuelle / CA annuel), puis les coûts en sont le complément.
  const currentMonthIndex = caArr.reduce((last, value, index) => (value !== null && value !== undefined) ? index : last, -1);
  const asOf = DATA && new Date(DATA.res_export_iso || DATA.file_mtime_iso || '');
  const isCurrentMonthPartial = currentMonthIndex >= 0 && asOf && !isNaN(asOf.getTime()) &&
    asOf.getFullYear() === Number(curYear) && asOf.getMonth() === currentMonthIndex &&
    asOf.getDate() < new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0).getDate();
  const completedCA = currentMonthIndex > 0 ? caArr.slice(0, currentMonthIndex).reduce((sum, value) => sum + (value || 0), 0) : 0;
  const remainingMonths = 12 - currentMonthIndex;
  const targetMarginRate = C.CA_OBJ > 0 ? C.MB_AN_OBJ / C.CA_OBJ : 0;
  const monthlyTargetCA = isCurrentMonthPartial && remainingMonths > 0 ? Math.max(0, (C.CA_OBJ - completedCA) / remainingMonths) : null;
  const monthlyTargetMB = monthlyTargetCA !== null ? monthlyTargetCA * targetMarginRate : null;
  const currentMonthProjection = monthlyTargetCA !== null ? {
    monthIndex: currentMonthIndex,
    ca: monthlyTargetCA,
    mb: monthlyTargetMB,
    costs: Math.max(0, monthlyTargetCA - monthlyTargetMB)
  } : null;
  var R = 9;
  const datasets = [
    // Marge brute (bas de la pile) : coins bas arrondis, jonction plate
    { type: 'bar', label: 'Marge brute', data: mb, backgroundColor: COLORS.green, stack: 's', order: 3,
      borderRadius: { topLeft: 0, topRight: 0, bottomLeft: R, bottomRight: R }, borderSkipped: false },
    // Achats & coûts (haut de la pile) : coins haut arrondis, jonction plate
    { type: 'bar', label: 'Achats & coûts (reste du CA)', data: reste, backgroundColor: COLORS.red, stack: 's', order: 3,
      borderRadius: { topLeft: R, topRight: R, bottomLeft: 0, bottomRight: 0 }, borderSkipped: false }
  ];
  // La fin de mois projetée est une vraie pile Chart.js, et non plus une
  // surimpression canvas. Seul le complément au réalisé du mois est ajouté.
  if (currentMonthProjection) {
    var projectionMB = Array(12).fill(null);
    var projectionCosts = Array(12).fill(null);
    var projectedMonth = currentMonthProjection.monthIndex;
    var actualCA = caArr[projectedMonth] || 0;
    var actualMB = mb[projectedMonth] || 0;
    var remainingCA = Math.max(0, currentMonthProjection.ca - actualCA);
    var remainingMB = Math.max(0, Math.min(remainingCA, currentMonthProjection.mb - actualMB));
    projectionMB[projectedMonth] = remainingMB;
    projectionCosts[projectedMonth] = Math.max(0, remainingCA - remainingMB);
    if (remainingCA > 0) {
      datasets.push({
        type: 'bar', label: 'Projeté — marge brute', data: projectionMB,
        backgroundColor: 'rgba(79, 188, 188, 0.42)', stack: 's', order: 3,
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 }, borderSkipped: false, _projection: true
      });
      datasets.push({
        type: 'bar', label: 'Projeté — achats & coûts', data: projectionCosts,
        backgroundColor: 'rgba(255, 95, 133, 0.38)', stack: 's', order: 3,
        borderRadius: { topLeft: R, topRight: R, bottomLeft: 0, bottomRight: 0 }, borderSkipped: false, _projection: true
      });
    }
  }
  if (prevYears.length) {
    datasets.push({
      type: 'line', label: avgLabel, data: avgCA, stack: 'avgCA',
      borderColor: 'rgba(128, 122, 140, 0.45)', backgroundColor: 'rgba(201, 197, 207, 0.28)',
      borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 6, tension: 0.4, fill: 'origin', order: 10, spanGaps: true, _drawSalaryThresholdAfter: true,
    });
    datasets.push({
      type: 'line', label: avgLabelMB, data: avgMB, stack: 'avgMB',
      borderColor: 'rgba(128, 122, 140, 0.30)', backgroundColor: 'rgba(221, 218, 226, 0.48)',
      borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 6, tension: 0.4, fill: 'origin', order: 10, spanGaps: true,
    });
  }
  makeChart('chart-ca-mb', {
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { callback: v => fmtEUR(v) } } },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 11 },
            generateLabels: function (chart) {
              var base = Chart.defaults.plugins.legend.labels.generateLabels(chart).filter(function (item) {
                return !chart.data.datasets[item.datasetIndex]._projection;
              });
              var guides = [{ text: 'Seuil salaire brut ' + fmtEUR(C.MB_MIN), strokeStyle: COLORS.black, fillStyle: 'transparent', lineWidth: 2, pointStyle: 'circle', hidden: false, datasetIndex: -1 }];
              if (currentMonthProjection) guides.push({ text: 'Objectif fin de mois', strokeStyle: 'rgba(79, 188, 188, 0.55)', fillStyle: 'rgba(79, 188, 188, 0.22)', lineWidth: 1, pointStyle: 'rect', hidden: false, datasetIndex: -1 });
              return guides.concat(base);
            }
          },
          onClick: function (e, item, legend) {
            if (item.datasetIndex === -1 || item.datasetIndex == null) return;
            var chart = legend.chart, datasetIndex = item.datasetIndex;
            if (chart.isDatasetVisible(datasetIndex)) chart.hide(datasetIndex); else chart.show(datasetIndex);
          }
        },
        tooltip: {
          callbacks: {
            afterBody: (items) => {
              const i = items[0].dataIndex;
              const cv = caArr[i];
              const lines = cv != null ? ['CA total : ' + fmtEUR(cv)] : [];
              if (currentMonthProjection && i === currentMonthProjection.monthIndex) {
                lines.push('Objectif fin de mois : ' + fmtEUR(currentMonthProjection.ca));
                lines.push('dont marge brute : ' + fmtEUR(currentMonthProjection.mb) + ' (' + fmtPct(targetMarginRate, 1) + ')');
              }
              return lines;
            }
          }
        }
      }
    },
    plugins: [{
      id: 'salaryThreshold',
      draw: function (chart) {
        var area = chart.chartArea, ctx = chart.ctx, y = chart.scales.y;
        ctx.save();
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = COLORS.black;
        var thresholdY = y.getPixelForValue(C.MB_MIN);
        ctx.beginPath(); ctx.moveTo(area.left, thresholdY); ctx.lineTo(area.right, thresholdY); ctx.stroke();
        ctx.restore();
      },
      beforeDatasetsDraw: function (chart) {
        if (!chart.data.datasets.some(function (dataset) { return dataset._drawSalaryThresholdAfter; })) this.draw(chart);
      },
      afterDatasetDraw: function (chart, args) {
        if (chart.data.datasets[args.index]._drawSalaryThresholdAfter) this.draw(chart);
      }
    }]
  });
}
// Comparatif annuel horizontal : année en cours à date, exercices historiques complets.
function renderTauxAnnuel(cur, years) {
  var canvas = document.getElementById('chart-taux-annuel');
  if (!canvas) return;
  var n = cur.mois_renseignes;
  var order = Object.keys(years).sort().reverse();
  function totalForPeriod(yObj, k, currentYear) { return yObj.monthly[k].slice(0, currentYear ? n : 12).reduce(function (a, v) { return a + (v || 0); }, 0); }
  var labels = order.map(function (yk) { return String(yk) === String(cur.year) ? yk + ' (à date)' : yk; });
  var mbPct = order.map(function (yk) {
    var currentYear = String(yk) === String(cur.year);
    var ca = totalForPeriod(years[yk], 'ca', currentYear);
    var mb = totalForPeriod(years[yk], 'marge_brute', currentYear);
    return ca > 0 ? mb / ca * 100 : 0;
  });
  var restePct = mbPct.map(function (v) { return Math.max(0, 100 - v); });
  var historicalReference = historicalPlanReference({ years:years });
  var historicalMarginPct = historicalReference.margin * 100;
  var referenceNote = document.getElementById('taux-annuel-reference');
  if (referenceNote) referenceNote.innerHTML = 'Moyenne lissée ' + historicalReference.label + ' : <strong>' + fmtPct(historicalReference.margin, 1) + '</strong>';
  var R = 7;
  makeChart('chart-taux-annuel', {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Marge brute', data: mbPct, backgroundColor: COLORS.green, stack: 's', barPercentage: 0.7, categoryPercentage: 0.82,
          borderRadius: { topLeft: R, bottomLeft: R, topRight: 0, bottomRight: 0 }, borderSkipped: false },
        { label: 'Achats & coûts (reste du CA)', data: restePct, backgroundColor: COLORS.red, stack: 's', barPercentage: 0.7, categoryPercentage: 0.82,
          borderRadius: { topRight: R, bottomRight: R, topLeft: 0, bottomLeft: 0 }, borderSkipped: false }
      ]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, min: 0, max: 100, ticks: { callback: function (v) { return v + '%'; } }, grid: { display: false } },
        y: { stacked: true, grid: { display: false }, ticks: { font: { weight: '800', size: 12.5 } } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ' : ' + fmtPct(ctx.parsed.x / 100, 1); } } }
      }
    },
    plugins: [{
      id: 'tauxAnnuelLabels',
      beforeDatasetsDraw: function (chart) {
        var xScale = chart.scales.x, area = chart.chartArea, x = xScale.getPixelForValue(historicalMarginPct), styles = getComputedStyle(document.documentElement);
        var ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = styles.getPropertyValue('--gray').trim();
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(x, area.top); ctx.lineTo(x, area.bottom); ctx.stroke();
        ctx.restore();
      },
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = '800 12px ' + CHART_FONT; ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
        [[0, mbPct], [1, restePct]].forEach(function (pair) {
          var meta = chart.getDatasetMeta(pair[0]), vals = pair[1];
          meta.data.forEach(function (bar, i) {
            var p = bar.getProps(['x', 'base', 'y']);
            var w = Math.abs(p.x - p.base);
            if (w > 42) ctx.fillText(fmtPct(vals[i] / 100, 1), (p.x + p.base) / 2, p.y);
          });
        });
        ctx.restore();
      }
    }]
  });
}
function renderCumulChart(years, currentYear, metric) {
  var isCA = metric === 'ca';
  var metricKey = isCA ? 'ca' : 'marge_brute';
  var metricName = isCA ? "Chiffre d'affaires" : 'Marge brute';
  var metricShort = isCA ? 'CA' : 'MB';
  var target = isCA ? C.CA_OBJ : C.MB_AN_OBJ;
  var currentColor = isCA ? COLORS.blue : '#7C5AD6';
  const yearKeys = Object.keys(years).sort();
  const previousYear = String(Number(currentYear) - 1);
  const hasPreviousYear = !!years[previousYear];
  // Toutes les années précédentes complètes, sans écarter la première si elle couvre bien 12 mois.
  const prevYears = yearKeys.filter(y => {
    if (Number(y) >= Number(currentYear)) return false;
    const year = years[y];
    const months = year.months_present;
    const values = year.monthly[metricKey];
    return Array.from({ length: 12 }, (_, m) => m).every(m =>
      months ? months.includes(m + 1) : values[m] !== null && values[m] !== undefined);
  });
  const cumOf = yk => { let c = 0; return years[yk].monthly[metricKey].map(v => v === null ? null : (c += v, c)); };
  const curCum = cumOf(currentYear);
  const prevCums = prevYears.map(cumOf);
  const avgCum = [];
  for (let m = 0; m < 12; m++) {
    const vals = prevCums.map(a => a[m]).filter(v => v !== null && v !== undefined);
    avgCum.push(vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null);
  }
  const avgLabel = prevYears.length ? 'Moyenne ' + prevYears[0] + (prevYears.length > 1 ? '–' + prevYears[prevYears.length - 1] : '') : '';
  var title = document.getElementById('cumul-chart-title');
  const comparisonLabels = [];
  if (hasPreviousYear) comparisonLabels.push(previousYear + ' (N−1)');
  if (avgLabel) comparisonLabels.push(avgLabel.charAt(0).toLowerCase() + avgLabel.slice(1));
  if (title) title.textContent = metricName + ' cumulé — ' + currentYear + (comparisonLabels.length ? ' vs ' + comparisonLabels.join(' et ') : '');
  const datasets = [
    { label: currentYear + ' (en cours)', data: curCum, borderColor: currentColor, backgroundColor: 'transparent', borderWidth: 3, pointRadius: 0, pointHoverRadius: 6, tension: 0.4, spanGaps: false },
  ];
  if (hasPreviousYear) {
    datasets.push({ label: previousYear + ' (N−1)', data: cumOf(previousYear), borderColor: COLORS.gray, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, pointHoverRadius: 6, tension: 0.4, spanGaps: false });
  }
  if (prevYears.length) {
    datasets.push({ label: avgLabel, data: avgCum, borderColor: COLORS.gray, backgroundColor: 'transparent', borderDash: [5, 4], borderWidth: 2, pointRadius: 0, pointHoverRadius: 6, tension: 0.4, spanGaps: true });
  }
  makeChart('chart-cumul', {
    type: 'line',
    data: { labels: MONTH_NAMES, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: v => fmtEUR(v) },
          title: { display: true, text: metricShort + ' cumulé (€)', font: { size: 11 } },
        },
      },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { mode: 'index', intersect: false, callbacks: { label: c => c.dataset.label + ' : ' + fmtEUR(c.parsed.y) } },
      },
    },
    plugins: [{
      id: 'objectifLineaire',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: { left, right }, scales: { y } } = chart;
        ctx.save();
        ctx.strokeStyle = '#3b82f6'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
        const x0 = chart.scales.x.getPixelForValue(0);
        const x12 = chart.scales.x.getPixelForValue(11);
        const y0 = y.getPixelForValue(target / 12);
        const y12 = y.getPixelForValue(target);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x12, y12); ctx.stroke();
        ctx.fillStyle = '#3b82f6'; ctx.font = '700 11px ' + CHART_FONT;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText("Objectif " + fmtEUR(target) + "/an · " + fmtEUR(target / 12) + "/mois", chart.chartArea.left + 6, chart.chartArea.top + 4);
        ctx.restore();
      }
    }],
  });
}

function renderWaterfall(cur, cy) {
  function ytdK(key) { return cy.monthly[key].reduce((a, v) => a + (v || 0), 0); }
  const ca = cur.ytd_ca;
  const segs = [
    { label: 'Achats matières', val: cur.ytd_achats, col: COLORS.red },
    { label: 'Salaire (rémunérations)', val: ytdK('remunerations'), col: COLORS.blue },
    { label: 'Charges de fonctionnement', val: ytdK('charges_fonct'), col: COLORS.orange },
    { label: 'Contribution coopérative', val: ytdK('contribution_coop'), col: COLORS.teal },
  ];
  const used = segs.reduce((a, s) => a + s.val, 0);
  const reste = ca - used;
  if (reste > 0) segs.push({ label: 'Résultat restant', val: reste, col: COLORS.green });
  const arcBorder = DARK ? '#16141d' : '#ffffff';
  const valColor = DARK ? '#eae7f0' : '#221f2b';
  makeChart('chart-waterfall', {
    type: 'doughnut',
    data: { labels: segs.map(s => s.label), datasets: [{ data: segs.map(s => s.val), backgroundColor: segs.map(s => s.col), borderColor: arcBorder, borderWidth: 3, hoverOffset: 7 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' ' + c.label + ' : ' + fmtEUR(c.parsed) + (ca > 0 ? ' (' + Math.round(c.parsed / ca * 100) + '%)' : '') } },
      },
    },
    plugins: [{
      id: 'centerCA',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const x = (left + right) / 2, y = (top + bottom) / 2;
        ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = CHART_TEXT; ctx.font = '700 11px ' + CHART_FONT;
        ctx.fillText('CA cumulé', x, y - 13);
        ctx.fillStyle = valColor; ctx.font = '800 19px ' + CHART_FONT;
        ctx.fillText(fmtEUR(ca), x, y + 6);
        ctx.restore();
      }
    }],
  });
  var _rk = document.getElementById('repart-kpis');
  if (_rk) {
    var _ryr = cur.reference_year, _pyw = (_ryr && DATA.years[_ryr]) ? DATA.years[_ryr] : null, _nw = cur.mois_renseignes;
    var _sumN = function (obj, ks) { return ks.reduce(function (s, k) { return s + obj.monthly[k].slice(0, _nw).reduce(function (a, v) { return a + (v || 0); }, 0); }, 0); };
    var _costKeys = ['achats_matieres', 'remunerations', 'charges_fonct', 'contribution_coop'];
    var _caN1 = _pyw ? _sumN(_pyw, ['ca']) : null;
    var _usedN1 = _pyw ? _sumN(_pyw, _costKeys) : null;
    var _pill = function (delta, base, goodUp) {
      if (base === null || base === undefined || base <= 0) return '';
      var up = delta >= 0, good = goodUp ? up : !up;
      return '<span class="kpi-pill ' + (good ? 'up' : 'down') + '"><span class="tri">' + (up ? '\u25B2' : '\u25BC') + '</span>' + fmtPct(Math.abs(delta / base), 1) + '</span>';
    };
    _rk.innerHTML =
      '<div class="rk"><div class="rk-label">CA cumulé</div><div class="rk-main"><span class="rk-val">' + fmtEUR(ca) + '</span>' + _pill(ca - (_caN1 || 0), _caN1, true) + '</div><div class="rk-sub">' + (_caN1 !== null ? 'vs ' + fmtEUR(_caN1) + ' en ' + _ryr : '\u00A0') + '</div></div>' +
      '<div class="rk"><div class="rk-label">Coûts totaux</div><div class="rk-main"><span class="rk-val">' + fmtEUR(used) + '</span>' + _pill(used - (_usedN1 || 0), _usedN1, false) + '</div><div class="rk-sub">' + (ca > 0 ? Math.round(used / ca * 100) + '%' : '—') + ' du CA' + (_usedN1 !== null ? ' · vs ' + fmtEUR(_usedN1) + ' en ' + _ryr : '') + '</div></div>';
  }
  const leg = document.getElementById('repartition-legend');
  if (leg) leg.innerHTML = segs.map(s =>
    '<div class="rl-row"><span class="rl-dot" style="background:' + s.col + '"></span>' +
    '<span class="rl-lab">' + esc(s.label) + '</span>' +
    '<span class="rl-val">' + fmtEUR(s.val) + '</span>' +
    '<span class="rl-pct">' + (ca > 0 ? Math.round(s.val / ca * 100) + '%' : '—') + '</span></div>').join('');
}
function renderAchatsCAChart(cy) {
  const ca = cy.monthly.ca.map(v => v === null ? null : v);
  const achats = cy.monthly.achats_matieres.map(v => v === null ? null : v);
  const ratio = ca.map((c,i) => (c && achats[i] !== null) ? (achats[i]/c)*100 : null);
  const highlight = ratio.map(r => r !== null && r/100 > C.RATIO_ALERTE);
  makeChart('chart-achats-ca', {
    data: {
      labels: MONTH_NAMES,
      datasets: [
        { type:'bar', label: 'CA', data: ca, backgroundColor: COLORS.blue, yAxisID: 'y' },
        { type:'bar', label: 'Achats matières', data: achats, backgroundColor: COLORS.red, yAxisID: 'y' },
        { type:'line', label: 'Ratio achats/CA (%)', data: ratio, borderColor: COLORS.orange,
          backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, yAxisID: 'y1', tension: 0.2 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { callback: v => fmtEUR(v) } },
        y1: { position: 'right', beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { drawOnChartArea: false } },
      },
      plugins: { legend: { position: 'bottom' } },
    },
    plugins: [
      {
        id: 'highlightBg',
        beforeDatasetsDraw(chart) {
          const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
          ctx.save(); ctx.fillStyle = COLORS.redA;
          highlight.forEach((h,i) => {
            if (h) {
              const xc = x.getPixelForValue(i);
              const w = (x.getPixelForValue(1) - x.getPixelForValue(0)) * 0.9;
              ctx.fillRect(xc - w/2, top, w, bottom - top);
            }
          });
          ctx.restore();
        }
      },
      {
        id: 'ratioThreshold',
        afterDatasetsDraw(chart) {
          const { ctx, chartArea: { left, right }, scales: { y1 } } = chart;
          if (!y1) return;
          ctx.save(); ctx.strokeStyle = COLORS.orange; ctx.setLineDash([4,3]); ctx.lineWidth = 1.5;
          const yp = y1.getPixelForValue(C.RATIO_CIBLE * 100);
          ctx.beginPath(); ctx.moveTo(left, yp); ctx.lineTo(right, yp); ctx.stroke();
          ctx.fillStyle = COLORS.orange; ctx.font = '10px sans-serif';
          ctx.fillText('seuil ratio ' + (C.RATIO_CIBLE*100).toFixed(0) + '%', left + 4, yp - 3);
          ctx.restore();
        }
      }
    ],
  });
}

// ============ STANDALONE : upload + réglages + bootstrap ============
var SETTINGS_KEY = 'cabestan_dashboard_settings_v1';
var PLAN_KEY = 'cabestan_dashboard_annual_plan_v1';
// Coefficient personnel indicatif : net avant impôt estimé à partir du brut Louty.
// Calibré sur octobre–décembre 2025 : 1 500 € nets pour 2 290,33 € Louty.
var NET_FROM_GROSS = 0.654926;
var LEGACY_NET_FROM_GROSS = 0.76;
var UPLOAD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
var PLAN = null;
// Valeurs par défaut = celles de C au chargement
var C_DEFAULTS = JSON.parse(JSON.stringify(C));
// Clés en pourcentage (stockées en fraction dans C, saisies en % dans l'UI)
var PCT_KEYS = { TAUX_DANGER:1, TAUX_OBJ:1, TAUX_EXC:1, RATIO_CIBLE:1, RATIO_ALERTE:1 };
var EUR_KEYS = ['MB_AN_OBJ','CA_OBJ','MB_MIN'];
var ALL_KEYS = EUR_KEYS.concat(Object.keys(PCT_KEYS));
var LAST_DATA = null;
var DATA_KEY = 'cabestan_dashboard_data_v1';

function loadSettings() {
  try {
    var raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      var s = JSON.parse(raw);
      ALL_KEYS.forEach(function (k) { if (typeof s[k] === 'number' && isFinite(s[k])) C[k] = s[k]; });
    }
  } catch (e) { /* ignore */ }
}
function saveSettings() {
  var out = {};
  ALL_KEYS.forEach(function (k) { out[k] = C[k]; });
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(out)); } catch (e) { /* ignore */ }
}
function fillSettingsForm() {
  ALL_KEYS.forEach(function (k) {
    var el = document.getElementById('set-' + k);
    if (!el) return;
    el.value = PCT_KEYS[k] ? +(C[k] * 100).toFixed(2) : C[k];
  });
}
function readSettingsForm() {
  ALL_KEYS.forEach(function (k) {
    var el = document.getElementById('set-' + k);
    if (!el) return;
    var v = parseFloat(String(el.value).replace(',', '.'));
    if (!isFinite(v)) return;
    if (v <= 0) return; // objectifs/seuils strictement positifs (évite les divisions par zéro)
    C[k] = PCT_KEYS[k] ? v / 100 : v;
  });
}

function _sumMetric(year, key) {
  return (year && year.monthly && year.monthly[key] || []).reduce(function (sum, v) { return sum + (v || 0); }, 0);
}
function historicalPlanReference(data) {
  var keys = Object.keys(data.years || {}).sort();
  // L'exercice le plus récent est en cours : on prend les deux exercices complets qui le précèdent.
  var refs = keys.slice(Math.max(0, keys.length - 3), Math.max(0, keys.length - 1));
  if (!refs.length && keys.length) refs = keys.slice(-1);
  var totals = { ca:0, mb:0, achats:0, remuneration:0, charges:0, contribution:0 };
  refs.forEach(function (yk) {
    var y = data.years[yk];
    totals.ca += _sumMetric(y, 'ca');
    totals.mb += _sumMetric(y, 'marge_brute');
    totals.achats += _sumMetric(y, 'achats_matieres');
    totals.remuneration += _sumMetric(y, 'remunerations');
    totals.charges += _sumMetric(y, 'charges_fonct');
    totals.contribution += _sumMetric(y, 'contribution_coop');
  });
  var n = refs.length || 1;
  var annualCharges = (totals.charges + totals.contribution) / n;
  var annualSalary = totals.remuneration / n;
  var annualMB = totals.mb / n;
  // Le surplus est une estimation de pilotage : il ne préjuge pas de son affectation en clôture.
  var surplus = Math.max(0, annualMB - annualSalary - annualCharges);
  var n1Key = refs[refs.length - 1] || keys[keys.length - 1];
  var n1Year = n1Key ? data.years[n1Key] : null;
  var n1ChargesFonct = _sumMetric(n1Year, 'charges_fonct');
  var n1Contribution = _sumMetric(n1Year, 'contribution_coop');
  var n1CA = _sumMetric(n1Year, 'ca');
  var n1MB = _sumMetric(n1Year, 'marge_brute');
  var n1Salary = _sumMetric(n1Year, 'remunerations');
  var n1Charges = n1ChargesFonct + n1Contribution;
  var n1NetResult = n1MB - n1Salary - n1Charges;
  var n1Surplus = Math.max(0, n1NetResult);
  return {
    years: refs,
    label: refs.length > 1 ? refs[0] + '–' + refs[refs.length - 1] : (refs[0] || 'historique disponible'),
    // Les objectifs personnels se renouvellent d'un exercice à l'autre : N-1 est leur seule référence.
    salary: n1Salary || annualSalary || C.MB_MIN * 12,
    surplus: n1Surplus,
    ca: totals.ca / n || C.CA_OBJ,
    margin: totals.ca > 0 ? totals.mb / totals.ca : C.TAUX_OBJ,
    purchases: totals.ca > 0 ? totals.achats / totals.ca : C.RATIO_CIBLE,
    charges: annualCharges || Math.max(0, C.MB_AN_OBJ - C.MB_MIN * 12),
    n1: {
      year: n1Key || 'N-1',
      charges: n1ChargesFonct + n1Contribution,
      chargesFonct: n1ChargesFonct,
      contribution: n1Contribution,
      salary: n1Salary,
      netResult: n1NetResult,
      surplus: n1Surplus,
      margin: n1CA > 0 ? n1MB / n1CA : (totals.ca > 0 ? totals.mb / totals.ca : C.TAUX_OBJ)
    }
  };
}
function _planRoundedSalaryReference(ref) { return Math.ceil(ref.salary / 12 * NET_FROM_GROSS) / NET_FROM_GROSS * 12; }
function loadPlan(data) {
  var ref = historicalPlanReference(data);
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(PLAN_KEY) || 'null'); } catch (e) {}
  var savedCoefficient = saved && isFinite(saved.netCoefficient) ? saved.netCoefficient : LEGACY_NET_FROM_GROSS;
  var savedSalary = saved && isFinite(saved.salary) ? saved.salary : null;
  // Un objectif saisi est une intention en net : il reste inchangé lorsque le coefficient évolue.
  // Une trajectoire historique, elle, repart toujours de la rémunération brute N-1 de Louty.
  var salary = savedSalary === null || saved.source === 'historical' ? _planRoundedSalaryReference(ref) : savedSalary * savedCoefficient / NET_FROM_GROSS;
  PLAN = {
    salary: salary,
    surplus: saved && isFinite(saved.surplus) ? saved.surplus : ref.surplus,
    margin: saved && isFinite(saved.margin) ? saved.margin : ref.margin,
    charges: saved && isFinite(saved.charges) ? saved.charges : ref.charges,
    netCoefficient: NET_FROM_GROSS,
    source: saved && saved.source ? saved.source : (saved ? 'custom' : 'historical')
  };
  PLAN.ca = (PLAN.salary + PLAN.charges + PLAN.surplus) / PLAN.margin;
  return ref;
}
function savePlan() { try { PLAN.netCoefficient = NET_FROM_GROSS; localStorage.setItem(PLAN_KEY, JSON.stringify(PLAN)); } catch (e) {} }
function applyPlanToCharts() {
  if (!PLAN) return;
  C.MB_MIN = PLAN.salary / 12;
  C.MB_AN_OBJ = PLAN.salary + PLAN.charges + PLAN.surplus;
  C.CA_OBJ = (PLAN.salary + PLAN.charges + PLAN.surplus) / PLAN.margin;
  C.TAUX_OBJ = PLAN.margin;
  // Le ratio achats reste un levier distinct : on évite de le déduire artificiellement du taux de marge.
}
function _planNum(id) { var el = document.getElementById(id); return el ? parseFloat(el.value) : NaN; }
function _planFmtSource(ref) { return 'Moyenne réelle pondérée · ' + ref.label; }
function _planIsReference(value, reference) { return Math.abs((value || 0) - (reference || 0)) < 0.01; }
function _planOrigin(value, reference, ref, formatter, n1Reference, hideReferenceNote) {
  var same = _planIsReference(value, reference);
  var sameN1 = !same && typeof n1Reference === 'number' && _planIsReference(value, n1Reference);
  var label = same ? 'Base historique · ' + ref.label : (sameN1 ? 'Référence N-1 · ' + ref.n1.year : 'Personnalisé · ' + formatter(value));
  var title = same ? 'Valeur issue de tes données réelles ' + ref.label : (sameN1 ? 'Valeur identique à celle de N-1 (' + ref.n1.year + ')' : 'Valeur modifiée par rapport à tes références historiques');
  return '<span class="cap-origin' + (sameN1 ? ' n1' : (same ? '' : ' custom')) + '" title="' + title + '">' + label + '</span>' +
    (same || sameN1 || hideReferenceNote ? '' : ' <span class="cap-reference-note">Réf. ' + ref.label + ' : ' + formatter(reference) + '</span>');
}

function capIcon(kind, tone) {
  var paths = {
    wallet: '<path d="M20 8V5a2 2 0 0 0-2-2L5 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1 0-4"/><path d="M20 12h-5v5h5M16 14.5h.01"/>',
    chart: '<path d="M4 14h3v7H4zM10 9h3v12h-3zM16 3h3v18h-3z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5z"/>',
    trend: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 15l2.5 2.5L16 12"/>'
  };
  return '<span class="cap-stat-icon' + (tone ? ' ' + tone : '') + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[kind] + '</svg></span>';
}
function capSectionIcon(kind) { return capIcon(kind).replace('cap-stat-icon', 'cap-section-icon'); }

function renderAnnualCap(data) {
  var host = document.getElementById('annual-cap');
  if (!host) return;
  var ref = historicalPlanReference(data);
  if (!PLAN) loadPlan(data);
  var roundedRefSalary = _planRoundedSalaryReference(ref);
  var neededMB = PLAN.salary + PLAN.charges + PLAN.surplus;
  var requiredCA = neededMB / PLAN.margin;
  var salaryReferenceNet = Math.ceil(ref.salary / 12 * NET_FROM_GROSS);
  var salaryChangePct = salaryReferenceNet > 0 ? (Math.round(PLAN.salary / 12 * NET_FROM_GROSS) / salaryReferenceNet - 1) * 100 : 0;
  var surplusChangePct = ref.surplus > 0 ? (PLAN.surplus / ref.surplus - 1) * 100 : 0;
  var marginReference = ref.n1 && isFinite(ref.n1.margin) ? ref.n1.margin : ref.margin;
  var marginReferencePeriod = ref.n1 && ref.n1.year ? ref.n1.year : ref.label;
  var chargesReference = ref.n1 && isFinite(ref.n1.charges) ? ref.n1.charges : ref.charges;
  var chargesReferencePeriod = ref.n1 && ref.n1.year ? ref.n1.year : ref.label;
  var maxCharges = Math.max(5000, Math.ceil(Math.max(ref.charges, PLAN.charges) * 1.8 / 1000) * 1000);
  host.innerHTML =
    '<div class="annual-cap-head"><div><h2 id="annual-cap-title">Mon cap annuel</h2><p class="annual-cap-intro">Tes objectifs personnels fixent les repères du tableau de bord.</p></div><button type="button" class="btn ghost" id="cap-edit" aria-haspopup="dialog" aria-controls="cap-drawer">Modifier mes objectifs</button></div>' +
    '<div class="cap-summary">' +
      '<div class="cap-aims"><span class="cap-aims-title">' + capSectionIcon('wallet') + 'Ce que je vise</span><div class="cap-personal-goals">' +
        '<div class="cap-stat cap-salary"><span class="cap-stat-copy"><span class="cap-label">Mon salaire net mensuel</span><span class="cap-value">' + fmtEUR(PLAN.salary / 12 * NET_FROM_GROSS) + ' <span class="cap-unit">/ mois</span></span><span class="cap-note">En ' + ref.n1.year + ' : <b>' + fmtEUR(roundedRefSalary / 12 * NET_FROM_GROSS) + ' / mois</b></span></span></div>' +
        '<div class="cap-stat"><span class="cap-stat-copy"><span class="cap-label">Mon résultat net annuel</span><span class="cap-value">' + fmtEUR(PLAN.surplus) + ' <span class="cap-unit">/ an</span></span><span class="cap-note">En ' + ref.n1.year + ' : <b>' + fmtEUR(ref.n1.netResult) + '</b></span></span></div>' +
      '</div></div>' +
      '<div class="cap-need-wrap"><span class="cap-need-kicker">' + capSectionIcon('trend') + 'Où j’en suis</span><div id="cap-actual" class="cap-actual"></div></div>' +
      '<div class="cap-need-wrap"><span class="cap-need-kicker">' + capSectionIcon('compass') + 'Le cap pour y arriver</span><div class="cap-need cap-margin"><span class="cap-metric-title">Marge brute à réaliser</span><strong><span class="cap-mb">' + fmtEUR(neededMB) + '</span></strong><span class="cap-need-detail">Soit environ <b>' + fmtEUR(neededMB / 12) + ' / mois</b></span></div><div class="cap-need cap-revenue"><span class="cap-metric-title">Chiffre d’affaires à réaliser</span><strong><span class="cap-ca">' + fmtEUR(requiredCA) + '</span></strong><span class="cap-need-detail">Soit environ <b>' + fmtEUR(requiredCA / 12) + ' / mois</b></span></div></div>' +
    '</div>' +
    '<div class="cap-sim" id="cap-sim" hidden>' +
      '<div class="cap-sim-head"><div><h3>Modifier mon cap et mes hypothèses</h3><p><span class="cap-origin">Référence</span> vient de tes données réelles ; <span class="cap-origin custom">Personnalisé</span> signale une valeur modifiée.</p></div><button type="button" class="btn ghost" id="cap-close">Fermer</button></div>' +
      '<div class="cap-inputs">' +
        '<div class="cap-field"><label for="cap-salary">Salaire net mensuel à financer</label><div class="cap-control-row"><div class="cap-linked-inputs"><input id="cap-salary" type="number" min="0" step="1" value="' + Math.round(PLAN.salary / 12 * NET_FROM_GROSS) + '"><span class="cap-percent-input"><input id="cap-salary-change" type="number" step="0.1" value="' + (Math.round(salaryChangePct * 10) / 10) + '" aria-label="Évolution du salaire par rapport à N-1"><span>%</span></span></div><button type="button" class="cap-mini-btn" id="cap-salary-ref">N-1 : ' + fmtEUR(salaryReferenceNet) + '</button></div><div class="cap-source">Salaire net moyen en ' + ref.n1.year + ' : <strong>' + fmtEUR(salaryReferenceNet) + '/mois</strong></div></div>' +
        '<div class="cap-field"><label for="cap-surplus">Résultat annuel visé</label><div class="cap-control-row"><div class="cap-linked-inputs"><input id="cap-surplus" type="number" min="0" step="1" value="' + Math.round(PLAN.surplus) + '"><span class="cap-percent-input"><input id="cap-surplus-change" type="number" step="0.1" value="' + (ref.surplus > 0 ? Math.round(surplusChangePct * 10) / 10 : '') + '" placeholder="—" aria-label="Évolution du résultat par rapport à N-1"' + (ref.surplus > 0 ? '' : ' disabled title="Impossible à calculer : le résultat N-1 est nul ou négatif"') + '><span>%</span></span></div><button type="button" class="cap-mini-btn" id="cap-surplus-ref">N-1 : ' + fmtEUR(ref.surplus) + '</button></div><div class="cap-source">Résultat net N-1 (' + ref.n1.year + ') : <strong>' + fmtEUR(ref.n1.netResult) + '</strong></div></div>' +
        '<div class="cap-field cap-slider-field"><label for="cap-margin"><span class="cap-label-copy">Taux de marge brute sur CA prévisionnel <span class="sp-help" data-tip="Taux de marge brute = marge brute ÷ chiffre d’affaires. La marge brute est ce qui reste du CA après les achats matières ; elle sert ensuite à financer salaires, charges, contribution coopérative et résultat visé." tabindex="0" aria-label="Explication du taux de marge brute">?</span></span></label><output class="cap-slider-value" id="cap-margin-out">' + fmtPct(PLAN.margin, 1) + '</output><div class="cap-control-row"><div class="cap-range"><input id="cap-margin" type="range" min="0.2" max="0.9" step="0.005" value="' + PLAN.margin + '"><span class="cap-range-marker" style="left:' + Math.max(0, Math.min(100, (marginReference - 0.2) / 0.7 * 100)) + '%" title="Référence : ' + fmtPct(marginReference, 1) + ' · ' + marginReferencePeriod + '"><span class="cap-range-ref-value">' + fmtPct(marginReference, 1) + '</span><span class="cap-range-ref-period">' + marginReferencePeriod + '</span></span></div><button type="button" class="cap-mini-btn" id="cap-margin-n1">N-1 : ' + fmtPct(ref.n1.margin, 1) + '</button></div></div>' +
        '<div class="cap-field cap-slider-field"><label for="cap-charges"><span class="cap-label-copy">Charges annuelles à financer prévisionnelles <span class="sp-help" data-tip="Les charges à financer regroupent les charges de fonctionnement et la contribution coopérative. Elles s’ajoutent au salaire brut et au résultat visé pour calculer la marge brute nécessaire. N-1 (' + ref.n1.year + ') : ' + fmtEUR(ref.n1.chargesFonct) + ' de charges de fonctionnement + ' + fmtEUR(ref.n1.contribution) + ' de contribution coopérative = ' + fmtEUR(ref.n1.charges) + '." tabindex="0" aria-label="Détail des charges annuelles à financer">?</span></span></label><output class="cap-slider-value" id="cap-charges-out">' + fmtEUR(PLAN.charges) + '</output><div class="cap-control-row"><div class="cap-range"><input id="cap-charges" type="range" min="0" max="' + maxCharges + '" step="1" value="' + Math.min(maxCharges, Math.round(PLAN.charges)) + '"><span class="cap-range-marker" style="left:' + Math.max(0, Math.min(100, chargesReference / maxCharges * 100)) + '%" title="Référence : ' + fmtEUR(chargesReference) + ' · ' + chargesReferencePeriod + '"><span class="cap-range-ref-value">' + fmtEUR(chargesReference) + '</span><span class="cap-range-ref-period">' + chargesReferencePeriod + '</span></span></div><button type="button" class="cap-mini-btn" id="cap-charges-n1">N-1 : ' + fmtEUR(ref.n1.charges) + '</button></div></div>' +
      '</div><div class="cap-result" id="cap-result"></div><div class="cap-actions"><button type="button" class="btn primary" id="cap-apply">Utiliser cette trajectoire</button><button type="button" class="btn ghost" id="cap-reset">Revenir à mon historique</button></div><div class="cap-preview-status" id="cap-preview-status"></div>' +
    '</div>';
  var capDrawer = document.getElementById('cap-drawer');
  var capDrawerBackdrop = document.getElementById('cap-drawer-backdrop');
  var capSim = host.querySelector('#cap-sim');
  capSim.hidden = false;
  document.getElementById('cap-drawer-content').replaceChildren(capSim);
  var toggle = function (open, focusId) {
    capDrawer.classList.toggle('open', open); capDrawerBackdrop.style.display = open ? 'block' : 'none'; capDrawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) { updateCapPreview(ref); requestAnimationFrame(function () { var focus = document.getElementById(focusId); if (focus) { focus.focus({ preventScroll:true }); focus.closest('.cap-field').scrollIntoView({ block:'center' }); } }); }
    else { var editButton = document.getElementById('cap-edit'); if (editButton) editButton.focus({ preventScroll:true }); }
  };
  document.getElementById('cap-edit').addEventListener('click', function () { toggle(true, 'cap-salary'); });
  document.getElementById('cap-close').addEventListener('click', function () { toggle(false); });
  document.getElementById('cap-drawer-close').onclick = function () { toggle(false); };
  capDrawerBackdrop.onclick = function () { toggle(false); };
  capDrawer.onkeydown = function (event) { if (event.key === 'Escape') { event.preventDefault(); toggle(false); } };
  ['cap-margin','cap-charges'].forEach(function (id) {
    var field = document.getElementById(id);
    ['input','change'].forEach(function (eventName) { field.addEventListener(eventName, function () { updateCapPreview(ref); }); });
  });
  function syncPercentage(valueId, percentageId, reference) {
    var value = _planNum(valueId), percentage = document.getElementById(percentageId);
    if (!percentage || percentage.disabled || !isFinite(value) || reference <= 0) return;
    percentage.value = Math.round((value / reference - 1) * 1000) / 10;
  }
  function bindLinkedInputs(valueId, percentageId, reference) {
    var value = document.getElementById(valueId), percentage = document.getElementById(percentageId);
    ['input','change'].forEach(function (eventName) { value.addEventListener(eventName, function () { syncPercentage(valueId, percentageId, reference); updateCapPreview(ref); }); });
    if (percentage && !percentage.disabled) ['input','change'].forEach(function (eventName) { percentage.addEventListener(eventName, function () {
      var change = _planNum(percentageId);
      if (!isFinite(change)) return;
      value.value = Math.max(0, Math.round(reference * (1 + change / 100)));
      updateCapPreview(ref);
    }); });
  }
  bindLinkedInputs('cap-salary', 'cap-salary-change', salaryReferenceNet);
  bindLinkedInputs('cap-surplus', 'cap-surplus-change', ref.surplus);
  document.getElementById('cap-salary-ref').addEventListener('click', function () { document.getElementById('cap-salary').value = salaryReferenceNet; syncPercentage('cap-salary', 'cap-salary-change', salaryReferenceNet); updateCapPreview(ref); this.hidden = true; });
  document.getElementById('cap-surplus-ref').addEventListener('click', function () { document.getElementById('cap-surplus').value = ref.surplus; syncPercentage('cap-surplus', 'cap-surplus-change', ref.surplus); updateCapPreview(ref); this.hidden = true; });
  document.getElementById('cap-margin-n1').addEventListener('click', function () { document.getElementById('cap-margin').value = ref.n1.margin; updateCapPreview(ref); this.hidden = true; });
  document.getElementById('cap-charges-n1').addEventListener('click', function () {
    document.getElementById('cap-charges').value = ref.n1.charges;
    updateCapPreview(ref);
    this.hidden = true;
  });
  document.getElementById('cap-apply').addEventListener('click', function () {
    PLAN.salary = Math.max(0, _planNum('cap-salary') || 0) / NET_FROM_GROSS * 12; PLAN.surplus = Math.max(0, _planNum('cap-surplus') || 0);
    PLAN.margin = Math.max(0, _planNum('cap-margin') || 0); PLAN.charges = Math.max(0, _planNum('cap-charges') || 0); PLAN.ca = (PLAN.salary + PLAN.charges + PLAN.surplus) / PLAN.margin; PLAN.source = 'custom';
    toggle(false); savePlan(); applyPlanToCharts(); renderParsed(LAST_DATA);
  });
  document.getElementById('cap-reset').addEventListener('click', function () {
    PLAN = { salary:_planRoundedSalaryReference(ref), surplus:ref.surplus, margin:ref.margin, charges:ref.charges, source:'historical' }; PLAN.ca = (PLAN.salary + PLAN.charges + PLAN.surplus) / PLAN.margin;
    toggle(false); savePlan(); applyPlanToCharts(); renderParsed(LAST_DATA);
  });
}
function updateCapPreview(ref) {
  var monthlyNetSalary = Math.max(0, _planNum('cap-salary') || 0), salary = monthlyNetSalary / NET_FROM_GROSS * 12, surplus = Math.max(0, _planNum('cap-surplus') || 0), margin = Math.max(0, _planNum('cap-margin') || 0), charges = Math.max(0, _planNum('cap-charges') || 0);
  var wanted = salary + charges + surplus, ca = wanted / margin;
  var hasUnsavedChanges = !_planIsReference(salary, PLAN.salary) || !_planIsReference(surplus, PLAN.surplus) || !_planIsReference(margin, PLAN.margin) || !_planIsReference(charges, PLAN.charges);
  var referenceSalary = Math.ceil(ref.salary / 12 * NET_FROM_GROSS);
  document.getElementById('cap-margin-out').textContent = fmtPct(margin, 1);
  document.getElementById('cap-charges-out').textContent = fmtEUR(charges);
  document.getElementById('cap-salary-ref').hidden = _planIsReference(monthlyNetSalary, referenceSalary);
  document.getElementById('cap-surplus-ref').hidden = _planIsReference(surplus, ref.surplus);
  document.getElementById('cap-margin-n1').hidden = _planIsReference(margin, ref.n1.margin);
  document.getElementById('cap-charges-n1').hidden = _planIsReference(charges, ref.n1.charges);
  document.getElementById('cap-result').innerHTML = 'Pour atteindre ce cap, il faut générer <strong class="cap-mb">' + fmtEUR(wanted) + ' de marge brute</strong>, soit <strong class="cap-ca">' + fmtEUR(ca) + ' de CA</strong> à facturer sur une base de <strong>' + fmtPct(margin, 1) + ' de marge brute</strong> et <strong>' + fmtEUR(charges) + ' de charges annuelles</strong>.';
  document.getElementById('cap-preview-status').innerHTML = hasUnsavedChanges ? '<span class="cap-preview-label">Aperçu non enregistré. Cliquer sur « Utiliser cette trajectoire » pour appliquer ces modifications.</span>' : '';
}

// Panneau réglages
var panel = document.getElementById('settings-panel');
var backdrop = document.getElementById('settings-backdrop');
function openSettings(onboard) {
  fillSettingsForm();
  var ob = document.getElementById('sp-onboard');
  if (ob) ob.style.display = onboard === true ? 'block' : 'none';
  panel.classList.add('open'); backdrop.style.display = 'block';
}
function closeSettings() { panel.classList.remove('open'); backdrop.style.display = 'none'; }
document.getElementById('open-settings').addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', closeSettings);
backdrop.addEventListener('click', closeSettings);
document.getElementById('settings-save').addEventListener('click', function () {
  readSettingsForm(); saveSettings(); closeSettings();
  if (LAST_DATA) renderParsed(LAST_DATA); // ré-appliquer immédiatement
});
document.getElementById('settings-reset').addEventListener('click', function () {
  ALL_KEYS.forEach(function (k) { C[k] = C_DEFAULTS[k]; });
  saveSettings(); fillSettingsForm();
  if (LAST_DATA) renderParsed(LAST_DATA);
});

// ---- Mini-graphe barres mensuel (12 mois, simple, épuré) ----
function _miniBars(monthly, color, caption) {
  if (!monthly) return '';
  var present = [];
  for (var i = 0; i < 12; i++) if (monthly[i] != null) present.push(i);
  if (!present.length) return '';
  var nums = present.map(function (i) { return monthly[i] || 0; });
  var posMax = Math.max.apply(null, nums.concat([0]));
  var negMax = Math.max.apply(null, nums.map(function (v) { return -v; }).concat([0]));
  var range = (posMax + negMax) || 1;
  var basePct = negMax / range * 100;
  var cols = '';
  for (var m = 0; m < 12; m++) {
    var v = monthly[m];
    if (v == null) {
      // mois vide (à venir) : simple repère au niveau du zéro
      cols += '<div class="mbc-col empty" data-tip="' + MONTH_NAMES[m] + ' : à venir">' +
        '<div class="mbc-ph" style="bottom:' + basePct + '%"></div></div>';
    } else {
      var hp = Math.abs(v) / range * 100, bottom, height;
      if (v >= 0) { bottom = basePct; height = Math.max(hp, 1.5); }
      else { height = Math.max(hp, 1.5); bottom = basePct - hp; }
      cols += '<div class="mbc-col" data-tip="' + MONTH_NAMES[m] + ' : ' + fmtEUR(v) + '">' +
        '<div class="mbc-bar' + (v < 0 ? ' neg' : '') + '" style="bottom:' + bottom + '%; height:' + height + '%; background:' + (v < 0 ? 'var(--red)' : color) + '"></div></div>';
    }
  }
  var zero = negMax > 0 ? '<div class="mbc-zero" style="bottom:' + basePct + '%"></div>' : '';
  return '<div class="mbc"><div class="mbc-bars">' + zero + cols + '</div>' +
    '<div class="mbc-x"><span>' + MONTH_NAMES[0].toUpperCase() + '</span>' +
    '<span class="mbc-cap">' + caption + '</span>' +
    '<span>' + MONTH_NAMES[11].toUpperCase() + '</span></div></div>';
}

// ---- Carte statistique : deux jauges absolues, année en cours et N-1 ----
function _actualPerformanceCardHTML(cfg) {
  var value = cfg.value || 0, goal = cfg.goal || 0, refSame = cfg.refSame;
  var currentTotal = Math.max(value, goal);
  var currentRest = Math.max(0, currentTotal - value);
  var ratio = currentTotal > 0 ? function (amount) { return Math.max(0, Math.min(100, amount / currentTotal * 100)); } : function () { return 0; };
  var realizedPct = Math.round(ratio(value));
  var remainingPct = Math.round(ratio(currentRest));
  var delta = refSame != null ? value - refSame : null;
  var deltaPositive = delta != null && delta >= 0;
  var pillHtml = delta != null ? '<span class="mbx-pill ' + (deltaPositive ? 'pos' : 'neg') + '">' + (deltaPositive ? '▲' : '▼') + ' ' + fmtEUR(Math.abs(delta)) + '</span>' : '';
  var comparison = refSame != null ? '<div class="cap-comparison">vs même période en ' + (cfg.refYear || 'N−1') + '</div>' : '';
  var yearProgress = cfg.yearProgress || 0;
  var attainment = goal > 0 ? Math.round(value / goal * 100) : 0;
  var paceGap = value - (goal * yearProgress);
  var paceClass = paceGap > 0 ? 'ahead' : (paceGap < 0 ? 'behind' : 'on-track');
  var paceIcon = paceGap > 0 ? '▲' : (paceGap < 0 ? '▼' : '•');
  var chartId = 'chart-actual-' + cfg.shortLabel.toLowerCase();
  var chartData = { value:value, goal:goal, yearProgress:yearProgress };
  var chartLabel = cfg.title + ' : ' + fmtEUR(value) + ' réalisé, objectif annuel ' + fmtEUR(goal) + ', ' + fmtEUR(Math.abs(paceGap)) + (paceGap >= 0 ? ' d’avance' : ' de retard');
  return '<section class="actual-performance-card actual-performance-card--' + (cfg.shortLabel === 'CA' ? 'ca' : 'mb') + '">' +
    '<div class="actual-performance-main"><div class="mbx-head"><div class="mbx-title">' + cfg.title + '</div></div></div>' +
    '<div class="actual-performance-gauge"><div class="actual-gauge-summary">' +
      '<div class="actual-gauge-realized"><strong>' + fmtEUR(value) + '</strong><span>' + realizedPct + '% Réalisé</span></div>' +
      (currentRest ? '<div class="actual-gauge-remaining"><strong>' + fmtEUR(currentRest) + '</strong><span>' + remainingPct + '% Restant</span></div>' : '') +
    '</div><div class="actual-gauge-chart"><div style="height:100%" id="' + chartId + '" role="img" aria-label="' + esc(chartLabel) + '" data-gauge="' + esc(JSON.stringify(chartData)) + '"></div></div></div>' +
    '<div class="actual-performance-footer"><div class="actual-progress-grid">' +
      '<div class="actual-progress-item"><strong>' + fmtPct(yearProgress, 1) + '</strong><span>de l’année écoulée</span></div>' +
      '<div class="actual-progress-item"><strong class="' + paceClass + '">' + attainment + ' %</strong><span>de l’objectif atteint</span></div>' +
      '<div class="actual-progress-item"><strong class="actual-status ' + paceClass + '"><span>' + paceIcon + '</span>' + fmtEUR(Math.abs(paceGap)) + '</strong><span>' + (paceGap >= 0 ? 'd’avance sur le rythme' : 'de retard sur le rythme') + '</span></div>' +
    '</div><div class="actual-performance-comparison">' + pillHtml + comparison + '</div></div></section>';
}

function _renderActualPerformanceCharts() {
  ['mb', 'ca'].forEach(function (metric) {
    var id = 'chart-actual-' + metric, host = document.getElementById(id);
    if (!host) return;
    var data = JSON.parse(host.dataset.gauge);
    var style = getComputedStyle(host.closest('.actual-performance-card'));
    var color = function (name) { return style.getPropertyValue(name).trim(); };
    var total = Math.max(0, data.value, data.goal);
    var target = Math.max(0, Math.min(total, data.goal * data.yearProgress));
    var realized = Math.max(0, data.value), end = Math.max(realized, target);
    var ahead = data.value >= target;
    var amounts = [Math.min(realized, target), Math.abs(realized - target), total - end];
    var colors = [color('--actual-accent'), color(ahead ? '--green' : '--orange'), color('--actual-rest')];
    var cursor = 0;
    var series = amounts.map(function (amount, i) {
      var start = cursor; cursor += amount;
      return { type:'bar', stack:'progress', barWidth:12, data:[amount],
        itemStyle:{ color:colors[i], borderRadius:[start === 0 ? 6 : 0, cursor === total ? 6 : 0, cursor === total ? 6 : 0, start === 0 ? 6 : 0] }, emphasis:{ disabled:true } };
    });
    if (data.value < 0) series.push({ type:'bar', stack:'progress', barWidth:12, data:[data.value], itemStyle:{ color:color('--orange'), borderRadius:[6,0,0,6] } });
    series[0].markLine = { silent:true, symbol:'none', label:{ show:false },
      lineStyle:{ color:color('--text'), width:5, type:'solid', cap:'round' }, data:[{ xAxis:data.value }] };
    _makeEChart(id, function () { return {
      grid:{ left:4, right:4, top:8, bottom:8 },
      xAxis:{ type:'value', show:false, min:Math.min(0, data.value), max:total || 1 },
      yAxis:{ type:'category', show:false, data:['Avancement'] },
      tooltip:{ trigger:'axis', confine:true, formatter:function () {
        return (metric === 'ca' ? 'Chiffre d’affaires' : 'Marge brute') + '<br>Réalisé : ' + fmtEUR(data.value) +
          '<br>Objectif annuel : ' + fmtEUR(data.goal) + '<br>Attendu à date : ' + fmtEUR(target) +
          '<br>' + (ahead ? 'Avance : ' : 'Retard : ') + fmtEUR(Math.abs(data.value - target));
      } }, series:series
    }; });
  });
}

function _annualProgressCardHTML(cfg) {
  var refs = (cfg.referenceYears || []).filter(function (year) { return cfg.samePeriod && cfg.samePeriod[year]; });
  var previousYear = cfg.referenceYear && cfg.samePeriod[cfg.referenceYear] ? cfg.referenceYear : (refs.length ? refs[refs.length - 1] : null);
  var rows = [{ year:cfg.currentYear, sublabel:'À date', realized:cfg.value, total:cfg.goal, totalLabel:'Objectif annuel', current:true }];
  var average = null;
  if (refs.length > 1) {
    average = {
      realized: refs.reduce(function (sum, year) { return sum + (cfg.samePeriod[year].ytd || 0); }, 0) / refs.length,
      total: refs.reduce(function (sum, year) { return sum + (cfg.samePeriod[year].full || 0); }, 0) / refs.length
    };
    rows.push({ year:refs[0] + '–' + refs[refs.length - 1], sublabel:'Moyenne', realized:average.realized, total:average.total, totalLabel:'Total annuel moyen' });
  }
  if (previousYear) rows.push({ year:previousYear, sublabel:'Même période', realized:cfg.samePeriod[previousYear].ytd, total:cfg.samePeriod[previousYear].full, totalLabel:'Total annuel' });
  var deltas = [];
  if (average) deltas.push('<span class="annual-progress-delta average"><strong>' + (cfg.value - average.realized >= 0 ? '+' : '−') + fmtEUR(Math.abs(cfg.value - average.realized)) + '</strong>vs ' + esc(refs[0] + '–' + refs[refs.length - 1]) + '</span>');
  if (previousYear) deltas.push('<span class="annual-progress-delta previous"><strong>' + (cfg.value - cfg.samePeriod[previousYear].ytd >= 0 ? '+' : '−') + fmtEUR(Math.abs(cfg.value - cfg.samePeriod[previousYear].ytd)) + '</strong>vs ' + esc(previousYear) + '</span>');
  var accessible = rows.map(function (row) {
    return esc(row.year + ' : ' + fmtEUR(row.realized) + ' réalisé à date, ' + row.totalLabel + ' ' + fmtEUR(row.total));
  }).join('. ');
  return '<section class="card annual-progress-card"><h2>Comparatif d’avancement annuel</h2><p class="annual-progress-subtitle">' + esc(cfg.title) + ' — à fin ' + esc(cfg.asOfLabel) + '</p>' +
    (deltas.length ? '<div class="annual-progress-deltas">' + deltas.join('') + '</div>' : '') +
    '<div class="annual-progress-chart" style="height:' + (rows.length * 68 + 28) + 'px"><div style="height:100%" id="chart-annual-progress" role="img" aria-label="' + accessible + '" data-rows="' + esc(JSON.stringify(rows)) + '" data-metric="' + esc(cfg.shortLabel) + '">' + '</div></div></section>';
}

function _renderAnnualProgressChart() {
  var host = document.getElementById('chart-annual-progress');
  if (!host) return;
  var rows = JSON.parse(host.dataset.rows);
  _makeEChart(host.id, function () {
    var style = getComputedStyle(document.documentElement);
    var color = function (name) { return style.getPropertyValue(name).trim(); };
    var compact = host.clientWidth < 550;
    var maxTotal = Math.max.apply(null, rows.map(function (row) { return Math.max(row.total || 0, row.realized || 0); }).concat([1]));
    var minValue = Math.min.apply(null, rows.map(function (row) { return Math.min(row.total || 0, row.realized || 0); }).concat([0]));
    var rich = { value:{ fontSize:compact ? 12 : 16, fontWeight:800, color:color('--text'), lineHeight:22 },
      caption:{ fontSize:compact ? 8 : 10, color:color('--text-faint'), lineHeight:12 } };
    return {
      grid:{ left:compact ? 82 : 120, right:compact ? 92 : 130, top:0, bottom:30, outerBoundsMode:'none' },
      tooltip:{ trigger:'axis', confine:true, formatter:function (params) {
        var row = rows[params[0].dataIndex];
        return esc(String(row.year)) + '<br>Réalisé à date : ' + fmtEUR(row.realized) + '<br>' + row.totalLabel + ' : ' + fmtEUR(row.total);
      } },
      xAxis:{ type:'value', min:minValue, max:maxTotal, splitNumber:compact ? 2 : 3,
        axisLine:{ show:false }, axisTick:{ show:false }, splitLine:{ lineStyle:{ color:color('--border') } },
        axisLabel:{ color:color('--text-faint'), fontSize:compact ? 9 : 10.5, hideOverlap:true, formatter:function (value) { return fmtEUR(value); } } },
      yAxis:[0,1].map(function (side) { return {
        type:'category', inverse:true, position:side ? 'right' : 'left', data:rows.map(function (row) { return String(row.year); }),
        axisLine:{ show:false }, axisTick:{ show:false },
        axisLabel:{ interval:0, margin:10, rich:rich, formatter:function (value, index) {
          var row = rows[index];
          return side ? '{value|' + fmtEUR(row.total) + '}\n{caption|' + row.totalLabel.toUpperCase().replace(' ANNUEL MOYEN', ' ANNUEL\nMOYEN') + '}' :
            '{value|' + row.year + '}\n{caption|' + row.sublabel + '}';
        } }
      }; }),
      series:[
        { name:'Total annuel', type:'bar', barWidth:14, barGap:'-100%', silent:true, z:1,
          itemStyle:{ color:color('--bg-soft'), borderRadius:7 }, data:rows.map(function (row) { return row.total; }) },
        { name:'Réalisé à date', type:'bar', barWidth:14, z:2,
          labelLayout:function () { return { x:compact ? 82 : 120, align:'left' }; },
          label:{ show:true, position:'bottom', distance:8, color:color('--text-dim'), fontSize:compact ? 9 : 12,
            formatter:function (params) { return fmtEUR(params.value) + ' réalisé à date'; } },
          data:rows.map(function (row) { return { value:row.realized, itemStyle:{
            color:color(row.current ? (host.dataset.metric === 'CA' ? '--ca-blue' : '--violet') : '--gray'),
            borderRadius:row.realized < 0 || row.realized >= row.total ? 7 : [7,0,0,7]
          } }; }) }
      ]
    };
  });
}

function _statCardHTML(cfg) {
  var value = cfg.value || 0, goal = cfg.goal || 0, refSame = cfg.refSame, refFull = cfg.refFull, refYear = cfg.refYear;
  var yearProgress = cfg.yearProgress;
  var over = goal > 0 && value >= goal;
  var attSelf = goal > 0 ? Math.round(value / goal * 100) : null;
  var delta = (refSame != null) ? value - refSame : null;
  var deltaPositive = delta != null && delta >= 0;
  var accent = cfg.barColor || '#7C5AD6';
  var scaleMax = Math.max(value, goal, refSame || 0, refFull || 0, 1);
  var width = function (amount) { return Math.max(0, Math.min(100, amount / scaleMax * 100)); };
  var relativeWidth = function (amount, total) { return total > 0 ? Math.max(0, Math.min(100, amount / total * 100)) : 0; };
  var pillHtml = delta != null ? '<span class="mbx-pill ' + (deltaPositive ? 'pos' : 'neg') + '">' + (deltaPositive ? '▲' : '▼') + ' ' + fmtEUR(Math.abs(delta)) + '</span>' : '';
  var badge = over ? '<span class="mbx-badge">✓ Objectif atteint</span>' : '';
  var progressHtml = '';
  if (yearProgress != null && goal > 0) {
    var paceGap = value - (goal * yearProgress);
    var paceClass = paceGap >= 0 ? 'ahead' : 'behind';
    var paceLabel = paceGap >= 0 ? 'd’avance sur le rythme' : 'de retard sur le rythme';
    var paceSign = paceGap >= 0 ? '+ ' : '− ';
    var attainmentLine = attSelf != null ? '<div class="mbx-progress-line"><strong class="mbx-attainment ' + paceClass + '">' + attSelf + ' %</strong><span class="mbx-progress-caption">de l’objectif atteint</span></div>' : '';
    progressHtml = '<div class="mbx-progress-summary"><div class="mbx-progress-title">Avancement sur l’année</div>' +
      '<div class="mbx-progress-line"><strong>' + fmtPct(yearProgress, 1) + '</strong><span class="mbx-progress-caption">de l’année écoulée</span></div>' +
      attainmentLine +
      '<div class="mbx-progress-pace"><strong class="' + paceClass + '">' + paceSign + fmtEUR(Math.abs(paceGap)) + '</strong><span class="mbx-progress-caption">' + paceLabel + '</span></div>' +
      (cfg.summaryOnly && cfg.shortLabel === 'MB' ? '<div class="mbx-progress-line"><strong>' + (over ? '+ ' : '') + fmtEUR(Math.abs(goal - value)) + '</strong><span class="mbx-progress-caption">' + (over ? 'de dépassement de l’objectif' : 'de marge brute restant à réaliser') + '</span></div>' : '') + '</div>';
  }
  var attHtml = progressHtml;
  var currentTotal = Math.max(value, goal);
  var currentRest = Math.max(0, currentTotal - value);
  var restAccent = cfg.shortLabel === 'CA' ? '#dceeff' : '#ebe2ff';
  var restTextAccent = cfg.shortLabel === 'CA' ? '#329ad1' : '#7c5ad6';
  var currentPct = Math.round(relativeWidth(value, currentTotal));
  var currentRestPct = Math.round(relativeWidth(currentRest, currentTotal));
  var currentGauge = '<div class="mbx-gauge"><div class="mbx-gauge-head"><div class="mbx-gauge-period"><strong>' + (cfg.currentYear || 'N') + '</strong><span>à date</span></div><div class="mbx-gauge-total"><span>Objectif annuel&nbsp;:</span><strong>' + fmtEUR(currentTotal) + '</strong></div></div><div class="mbx-gauge-plot" style="width:' + width(currentTotal) + '%">' +
    '<div class="mbx-gauge-track" style="--gauge-accent:' + accent + ';--gauge-rest:' + restAccent + ';--gauge-rest-text:' + restTextAccent + ';--marker-left:' + relativeWidth(value, currentTotal) + '%"><div class="mbx-gauge-fill current" style="width:' + relativeWidth(value, currentTotal) + '%"></div>' +
    (currentRest ? '<div class="mbx-gauge-rest current" style="left:' + relativeWidth(value, currentTotal) + '%; width:' + relativeWidth(currentRest, currentTotal) + '%"></div>' : '') +
    '<div class="mbx-gauge-marker" style="left:' + relativeWidth(value, currentTotal) + '%"></div>' +
    '<div class="mbx-gauge-callout realized current"><strong>' + fmtEUR(value) + '</strong><span>' + currentPct + '% Réalisé</span></div>' +
    (currentRest ? '<div class="mbx-gauge-callout remaining"><strong>' + fmtEUR(currentRest) + '</strong><span>' + currentRestPct + '% Restant</span></div>' : '') +
    '</div></div></div>';
  var priorGauge = '';
  if (refSame != null) {
    var priorTotal = Math.max(refSame, refFull || 0);
    var priorRest = Math.max(0, priorTotal - refSame);
    var priorPct = Math.round(relativeWidth(refSame, priorTotal));
    var priorRestPct = Math.round(relativeWidth(priorRest, priorTotal));
    priorGauge = '<div class="mbx-gauge"><div class="mbx-gauge-head"><div class="mbx-gauge-period"><strong>' + (refYear || 'N-1') + '</strong><span>Même période</span></div><div class="mbx-gauge-total"><span>Total ' + (cfg.shortLabel || '') + ' ' + (refYear || '') + '&nbsp;:</span><strong>' + fmtEUR(priorTotal) + '</strong></div></div><div class="mbx-gauge-plot" style="width:' + width(priorTotal) + '%">' +
      '<div class="mbx-gauge-track" style="--marker-left:' + relativeWidth(refSame, priorTotal) + '%"><div class="mbx-gauge-fill prior" style="width:' + relativeWidth(refSame, priorTotal) + '%"></div>' +
      (priorRest ? '<div class="mbx-gauge-rest prior" style="left:' + relativeWidth(refSame, priorTotal) + '%; width:' + relativeWidth(priorRest, priorTotal) + '%"></div>' : '') +
      '<div class="mbx-gauge-marker" style="left:' + relativeWidth(refSame, priorTotal) + '%"></div>' +
      '<div class="mbx-gauge-callout realized prior"><strong>' + fmtEUR(refSame) + '</strong><span>' + priorPct + '% Réalisé</span></div>' +
      (priorRest ? '<div class="mbx-gauge-callout remaining prior"><strong>' + fmtEUR(priorRest) + '</strong><span>' + priorRestPct + '% Restant</span></div>' : '') +
      '</div></div></div>';
  }
  var comparison = refSame != null ? '<div class="cap-comparison">vs même période en ' + (refYear || 'N−1') + (refYear ? ' (N−1)' : '') + '</div>' : '';
  var summary = '<div class="mbx-summary">' +
    '<div class="mbx-main"><div class="mbx-head"><div class="mbx-title">' + cfg.title + '</div>' + badge + '</div>' +
    '<div class="mbx-heroline"><div class="mbx-hero">' + fmtEUR(value) + '</div>' + pillHtml + '</div>' + comparison +
    (cfg.summaryOnly ? '<div class="mbx-gauge"><div class="mbx-gauge-plot"><div class="mbx-gauge-track" style="--gauge-accent:' + accent + ';--gauge-rest:' + restAccent + ';--gauge-rest-text:' + restTextAccent + '"><div class="mbx-gauge-fill current" style="width:' + relativeWidth(value, currentTotal) + '%"></div>' +
      (currentRest ? '<div class="mbx-gauge-rest current" style="left:' + relativeWidth(value, currentTotal) + '%; width:' + relativeWidth(currentRest, currentTotal) + '%"></div>' : '') +
      '<div class="mbx-gauge-marker" style="left:' + relativeWidth(value, currentTotal) + '%"></div>' +
      '<div class="mbx-gauge-callout realized current"><strong>' + fmtEUR(value) + '</strong><span>' + currentPct + '% Réalisé</span></div>' +
      (currentRest ? '<div class="mbx-gauge-callout remaining"><strong>' + fmtEUR(currentRest) + '</strong><span>' + currentRestPct + '% Restant</span></div>' : '') +
      '</div></div></div>' : '') + '</div>' +
    (attHtml ? '<div class="mbx-objective"><div class="mbx-prog-head">' + attHtml + '</div></div>' : '') + '</div>';
  if (cfg.summaryOnly) return summary;
  return '<div class="card statx-card"><h2 class="mbx-gauges-title">' + (cfg.shortLabel === 'CA' ? 'Avancement du chiffre d’affaires' : 'Avancement de la marge brute') + '</h2>' +
    '<div class="mbx-compare">' + currentGauge + priorGauge + '</div></div>';
}

// ---- Ligne 1 : cartes "Marge brute réalisée" + "Chiffre d'affaires cumulé" ----
function renderBanner(data, cur, prev) {
  try {
    var refYear = cur.reference_year;
    var sp = (refYear && cur.same_period && cur.same_period[refYear]) ? cur.same_period[refYear] : null;
    var cy = data.years[cur.year];
    var asOf = new Date(data.res_export_iso || data.file_mtime_iso || Date.now());
    var yearProgress = null;
    if (!isNaN(asOf.getTime()) && String(asOf.getFullYear()) === String(cur.year)) {
      var year = asOf.getFullYear();
      var asOfDay = Date.UTC(year, asOf.getMonth(), asOf.getDate());
      var startOfYear = Date.UTC(year, 0, 0);
      var daysInYear = (Date.UTC(year + 1, 0, 0) - startOfYear) / 86400000;
      yearProgress = (asOfDay - startOfYear) / 86400000 / daysInYear;
    }
    var pilotageCard = document.getElementById('bloc-pilotage');
    if (!pilotageCard) return;
    var isCA = pilotageMetric === 'ca';
    var capActual = document.getElementById('cap-actual');
    if (capActual) capActual.innerHTML = _actualPerformanceCardHTML({
      title: 'Marge brute réalisée', value: cur.ytd_mb, goal: C.MB_AN_OBJ,
      refSame: sp ? sp.mb_ytd : null, refFull: sp ? sp.mb_full : null, refYear: refYear,
      currentYear: cur.year, shortLabel: 'MB', yearProgress: yearProgress
    }) + _actualPerformanceCardHTML({
      title: "Chiffre d'affaires réalisé", value: cur.ytd_ca, goal: C.CA_OBJ,
      refSame: sp ? sp.ca_ytd : null, refFull: sp ? sp.ca_full : null, refYear: refYear,
      currentYear: cur.year, shortLabel: 'CA', yearProgress: yearProgress
    });
    _renderActualPerformanceCharts();
    var monthLabels = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    var metricKey = isCA ? 'ca' : 'mb';
    var period = {};
    Object.keys(cur.same_period || {}).forEach(function (year) {
      var source = cur.same_period[year];
      period[year] = { ytd:source[metricKey + '_ytd'], full:source[metricKey + '_full'] };
    });
    pilotageCard.innerHTML = _annualProgressCardHTML({
      title:isCA ? "Chiffre d'affaires" : 'Marge brute', value:isCA ? cur.ytd_ca : cur.ytd_mb, goal:isCA ? C.CA_OBJ : C.MB_AN_OBJ,
      samePeriod:period, referenceYears:cur.reference_years, referenceYear:refYear, currentYear:cur.year, shortLabel:isCA ? 'CA' : 'MB',
      asOfLabel:monthLabels[Math.max(0, cur.mois_renseignes - 1)] || 'la période'
    });
    _renderAnnualProgressChart();
  } catch (e) { /* rendu optionnel */ }
};

// ---- Modal de détail générique (liste poste / montant + total) ----
function _ensureDetailModal() {
  var m = document.getElementById('detail-modal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'detail-modal'; m.className = 'detail-modal';
  m.innerHTML =
    '<div class="dm-backdrop"></div>' +
    '<div class="dm-card" role="dialog" aria-modal="true">' +
      '<div class="dm-head"><div class="dm-title"></div>' +
        '<button type="button" class="dm-close" aria-label="Fermer">✕</button></div>' +
      '<div class="dm-body"></div>' +
    '</div>';
  document.body.appendChild(m);
  var close = function () { m.classList.remove('open'); };
  m.querySelector('.dm-backdrop').addEventListener('click', close);
  m.querySelector('.dm-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.classList.contains('open')) close(); });
  return m;
}
function openDetailModal(title, subtitle, rows, total, totalLabel) {
  var m = _ensureDetailModal();
  m.querySelector('.dm-title').innerHTML = esc(title) + (subtitle ? '<span class="dm-sub">' + esc(subtitle) + '</span>' : '');
  var body = (rows && rows.length)
    ? rows.map(function (r) { return '<div class="dm-row"><span class="dm-lab">' + esc(r.label) + '</span><span class="dm-eur">' + fmtEUR(r.amount) + '</span></div>'; }).join('')
    : '<div class="dm-empty">Aucun détail disponible.</div>';
  if (total != null && rows && rows.length) body += '<div class="dm-row dm-total"><span class="dm-lab">' + esc(totalLabel || 'Total') + '</span><span class="dm-eur">' + fmtEUR(total) + '</span></div>';
  m.querySelector('.dm-body').innerHTML = body;
  m.classList.add('open');
}

// ---- Carte "Répartition du CA" : lien "détail" sur les charges de fonctionnement ----
var _origRenderWaterfall = renderWaterfall;
renderWaterfall = function (cur, cy) {
  // 1) rendu d'origine : remplit la rangée "CA cumulé / Coûts totaux" (coûts totaux inchangés)
  _origRenderWaterfall(cur, cy);
  try {
    function ytdK(key) { return cy.monthly[key].reduce(function (a, v) { return a + (v || 0); }, 0); }
    var ca = cur.ytd_ca;
    var charges = ytdK('charges_fonct');
    var det = (DATA && DATA.charges_detail) ? DATA.charges_detail.slice() : [];
    // 2) Postes de charges dépassant le seuil (% du CA) -> segment dédié, retirés des charges
    var seuilPct = (typeof C.CHARGES_SEUIL_PCT === 'number') ? C.CHARGES_SEUIL_PCT : 0;
    var seuil = (seuilPct > 0 && ca > 0) ? seuilPct * ca : null;
    var isPulled = function (r) { return seuil !== null && r.amount >= seuil; };
    var pulled = det.filter(isPulled);
    var restDet = det.filter(function (r) { return !isPulled(r); });
    var pulledSum = pulled.reduce(function (a, r) { return a + r.amount; }, 0);
    var chargesRest = Math.max(0, charges - pulledSum);
    var extraCols = [COLORS.gray, '#9C6ADE', '#4FB0C6', '#E08A5B', '#B0863C'];

    var chargesLabel = pulled.length ? 'Charges de fonct. (autres)' : 'Charges de fonctionnement';
    var segs = [
      { label: 'Achats matières', val: cur.ytd_achats, col: COLORS.red },
      { label: 'Salaire (rémunérations)', val: ytdK('remunerations'), col: COLORS.blue },
      { label: chargesLabel, val: chargesRest, col: COLORS.orange, detail: restDet },
      { label: 'Contribution coopérative', val: ytdK('contribution_coop'), col: COLORS.teal }
    ];
    pulled.forEach(function (r, i) { segs.push({ label: r.label, val: r.amount, col: extraCols[i % extraCols.length] }); });
    var used = segs.reduce(function (a, s) { return a + s.val; }, 0);
    var reste = ca - used;
    if (reste > 0) segs.push({ label: 'Résultat restant', val: reste, col: COLORS.green });

    // 3) Redessine le donut avec les nouveaux segments
    var arcBorder = DARK ? '#16141d' : '#ffffff';
    var valColor = DARK ? '#eae7f0' : '#221f2b';
    makeChart('chart-waterfall', {
      type: 'doughnut',
      data: { labels: segs.map(function (s) { return s.label; }), datasets: [{ data: segs.map(function (s) { return s.val; }), backgroundColor: segs.map(function (s) { return s.col; }), borderColor: arcBorder, borderWidth: 3, hoverOffset: 7 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ' : ' + fmtEUR(c.parsed) + (ca > 0 ? ' (' + Math.round(c.parsed / ca * 100) + '%)' : ''); } } }
        }
      },
      plugins: [{
        id: 'centerCA',
        afterDraw: function (chart) {
          var a = chart.chartArea, ctx = chart.ctx;
          var x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
          ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = CHART_TEXT; ctx.font = '700 11px ' + CHART_FONT;
          ctx.fillText('CA cumulé', x, y - 13);
          ctx.fillStyle = valColor; ctx.font = '800 19px ' + CHART_FONT;
          ctx.fillText(fmtEUR(ca), x, y + 6);
          ctx.restore();
        }
      }]
    });

    // 4) Redessine la légende + lien "détail" sur la ligne charges (postes restants)
    var leg = document.getElementById('repartition-legend');
    if (!leg) return;
    leg.innerHTML = segs.map(function (s) {
      return '<div class="rl-row"><span class="rl-dot" style="background:' + s.col + '"></span>' +
        '<span class="rl-lab">' + esc(s.label) + '</span>' +
        '<span class="rl-val">' + fmtEUR(s.val) + '</span>' +
        '<span class="rl-pct">' + (ca > 0 ? Math.round(s.val / ca * 100) + '%' : '—') + '</span></div>';
    }).join('');
    var legRows = leg.querySelectorAll('.rl-row');
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].detail && segs[i].detail.length) {
        (function (seg, rowEl) {
          var link = document.createElement('button');
          link.type = 'button'; link.className = 'rl-detail'; link.textContent = 'détail';
          var tot = seg.detail.reduce(function (a, r) { return a + r.amount; }, 0);
          var sub = 'Postes cumulés ' + cur.year + (pulled.length ? ' · hors ' + pulled.map(function (p) { return p.label; }).join(', ') : '');
          link.addEventListener('click', function () {
            openDetailModal('Charges de fonctionnement', sub, seg.detail, tot, pulled.length ? 'Total (postes groupés)' : 'Total charges de fonctionnement');
          });
          rowEl.querySelector('.rl-lab').appendChild(link);
        })(segs[i], legRows[i]);
      }
    }
  } catch (e) { /* décomposition optionnelle */ }
};

// ---- Onglet Achats fusionné : ne garder que le KPI "Ratio achats / CA" ----
function renderAchats(cy, cur) {
  var wrap = document.getElementById('blocA');
  if (!wrap) return;
  var ratio = cur.ytd_ca ? (cur.ytd_achats / cur.ytd_ca) : null;
  function zc(r) { if (r === null) return ''; if (r > C.RATIO_ALERTE) return 'r-red'; if (r > C.RATIO_CIBLE) return 'r-orange'; return 'r-green'; }
  var years = (DATA && DATA.years) ? DATA.years : {};
  var cyYear = cur.year;
  var dateStr = (DATA && DATA.file_mtime_iso) ? new Date(DATA.file_mtime_iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  var rowsHtml = Object.keys(years).sort().reverse().map(function (yk) {
    var y = years[yk], ach, r, lbl;
    if (yk === cyYear) {
      // année en cours : total cumulé réel (pas de projection)
      ach = cur.ytd_achats;
      r = cur.ytd_ca ? cur.ytd_achats / cur.ytd_ca : null;
      lbl = yk + ' <span class="row-date">· au ' + dateStr + '</span>';
    } else {
      ach = y.monthly.achats_matieres.reduce(function (a, v) { return a + (v || 0); }, 0);
      var ca = y.monthly.ca.reduce(function (a, v) { return a + (v || 0); }, 0);
      r = ca > 0 ? ach / ca : null;
      lbl = yk;
    }
    return '<tr><td>' + lbl + '</td><td>' + fmtEUR(ach) + '</td>' +
           '<td><span class="ratio-pill ' + zc(r) + '">' + (r !== null ? fmtPct(r, 1) : '—') + '</span></td></tr>';
  }).join('');
  // Jauge qualitative à 4 zones de largeur égale (chacune un quart de l'arc).
  // Le curseur est positionné par zone puis interpolé à l'intérieur de sa zone,
  // pour que les proportions colorées ne dépendent pas de l'échelle numérique.
  var gTop = Math.max(0.05, C.RATIO_CIBLE - 0.06);
  var gMax = C.RATIO_ALERTE + 0.10;
  var lo = [0, gTop, C.RATIO_CIBLE, C.RATIO_ALERTE];
  var hi = [gTop, C.RATIO_CIBLE, C.RATIO_ALERTE, gMax];
  var gaugeHtml;
  var previousGauge = document.getElementById('chart-purchase-ratio');
  if (ratio === null) _disposeEChart('chart-purchase-ratio');
  if (ratio !== null) {
    var zi = ratio <= gTop ? 0 : (ratio <= C.RATIO_CIBLE ? 1 : (ratio <= C.RATIO_ALERTE ? 2 : 3));
    var within = Math.max(0, Math.min(1, (ratio - lo[zi]) / ((hi[zi] - lo[zi]) || 1)));
    var frac = (zi + within) / 4;
    var label = ['au top', 'bon', 'à surveiller', 'alerte'][zi];
    var description = 'Ratio achats / CA : ' + fmtPct(ratio, 1) + ', ' + label;
    gaugeHtml = '<div class="purchase-ratio-chart" id="chart-purchase-ratio" role="img" aria-label="' + esc(description) + '"></div>';
  } else {
    gaugeHtml = '<div class="ratio-big">—</div>';
  }
  // Taux de marge brute (marge brute ÷ CA) — rendu dans sa propre carte #bloc-taux
  _renderMarginRateChart(cur.taux_mb || 0);
  wrap.innerHTML =
    gaugeHtml +
    '<div class="ratio-legend">' +
      '<span class="rl-item"><span class="rl-dot" style="background:#7C5AD6"></span>Au top &lt; ' + fmtPct(gTop, 0) + '</span>' +
      '<span class="rl-item"><span class="rl-dot" style="background:var(--green)"></span>Bon &lt; ' + fmtPct(C.RATIO_CIBLE, 0) + '</span>' +
      '<span class="rl-item"><span class="rl-dot" style="background:var(--amber)"></span>À surveiller &lt; ' + fmtPct(C.RATIO_ALERTE, 0) + '</span>' +
      '<span class="rl-item"><span class="rl-dot" style="background:var(--red)"></span>Alerte &gt; ' + fmtPct(C.RATIO_ALERTE, 0) + '</span>' +
    '</div>' +
    '<table class="mini-annual"><thead><tr><th>Année</th><th>Achats</th><th>Ratio / CA</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>';
  if (ratio !== null) {
    if (previousGauge) {
      previousGauge.setAttribute('aria-label', description);
      document.getElementById('chart-purchase-ratio').replaceWith(previousGauge);
    }
    _renderPurchaseRatioChart(ratio, frac, label, gTop);
  }

};

// Shared SVG renderer and lifecycle for all migrated ECharts visualizations.
var echartInstances = {};
function _disposeEChart(id) {
  var entry = echartInstances[id];
  if (!entry) return;
  entry.observer.disconnect(); entry.chart.dispose(); delete echartInstances[id];
}
function _makeEChart(id, buildOption) {
  Object.keys(echartInstances).forEach(function (key) {
    if (echartInstances[key].chart.getDom() !== document.getElementById(key)) _disposeEChart(key);
  });
  var host = document.getElementById(id);
  if (!host) return;
  var entry = echartInstances[id];
  if (!entry) {
    var chart = LoutyECharts.init(host, null, { renderer:'svg', width:host.clientWidth || 220, height:host.clientHeight || 140 });
    entry = { chart:chart, buildOption:buildOption };
    entry.observer = new ResizeObserver(function () {
      // The initial observer notification must not finish the entry animation.
      if (host.clientWidth && host.clientHeight &&
          (chart.getWidth() !== host.clientWidth || chart.getHeight() !== host.clientHeight)) {
        chart.resize({ width:host.clientWidth, height:host.clientHeight });
        chart.setOption(entry.buildOption());
      }
    });
    entry.observer.observe(host);
    echartInstances[id] = entry;
  }
  entry.buildOption = buildOption;
  entry.chart.setOption(Object.assign({
    animation:!window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationDuration:900, animationEasing:'cubicOut', animationDurationUpdate:600, animationEasingUpdate:'cubicOut',
    textStyle:{ fontFamily:CHART_FONT }
  }, buildOption()), { notMerge:true });
}
function _makeEChartGauge(id, series, tooltipText, displayRate) {
  _makeEChart(id, function () {
    var style = getComputedStyle(document.getElementById(id));
    var animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return {
      animation:animate, animationDuration:1800, animationEasing:'quarticOut',
      animationDurationUpdate:1800, animationEasingUpdate:'quarticOut',
      tooltip:{ trigger:'item', confine:true, formatter:function () { return tooltipText; } },
      series:[Object.assign({ type:'gauge', startAngle:180, endAngle:0, center:['50%', '80%'], radius:'140%',
        axisTick:{ show:false }, splitLine:{ show:false }, axisLabel:{ show:false }, anchor:{ show:false },
        title:{ offsetCenter:[0, '8%'], color:style.getPropertyValue('--text-dim').trim(), fontSize:12, fontWeight:700 },
        detail:{ show:false }
      }, series), {
        // Keep the displayed percentage independent of the mapped/clamped arc value.
        type:'gauge', center:['50%', '80%'], radius:'140%', silent:true,
        axisLine:{ show:false }, axisTick:{ show:false }, splitLine:{ show:false },
        axisLabel:{ show:false }, pointer:{ show:false }, anchor:{ show:false }, title:{ show:false },
        detail:{ valueAnimation:animate, offsetCenter:[0, '-18%'],
          color:style.getPropertyValue('--text').trim(), fontSize:24, fontWeight:800,
          formatter:function (value) { return fmtPct(value / 100, 1); } },
        data:[{ value:displayRate * 100 }]
      }]
    };
  });
}
function _renderPurchaseRatioChart(ratio, fraction, label, topThreshold) {
  var style = getComputedStyle(document.getElementById('chart-purchase-ratio'));
  var color = function (name) { return style.getPropertyValue(name).trim(); };
  _makeEChartGauge('chart-purchase-ratio', {
    min:0, max:1,
    axisLine:{ lineStyle:{ width:18, color:[[0.25, '#7C5AD6'], [0.5, color('--green')], [0.75, color('--amber')], [1, color('--red')]] } },
    pointer:{ icon:'roundRect', length:26, width:4.5, offsetCenter:[0, '-79%'], itemStyle:{ color:color('--text') } },
    data:[{ value:fraction, name:label }]
  }, 'Ratio actuel : ' + fmtPct(ratio, 1) + '<br>Au top ≤ ' + fmtPct(topThreshold, 1) + '<br>Bon ≤ ' + fmtPct(C.RATIO_CIBLE, 1) + '<br>À surveiller ≤ ' + fmtPct(C.RATIO_ALERTE, 1) + '<br>Alerte au-delà', ratio);
}

// ---- "Tendance achats annuels" : comparaison horizontale (barre + montant + badge ratio) ----
function renderTrendChart(years) {
  var wrap = document.getElementById('chart-trend');
  if (!wrap) return;
  var yearKeys = Object.keys(years).sort();
  var rows = yearKeys.map(function (yk) {
    var y = years[yk];
    var mp = y.months_present.length;
    var ach = y.monthly.achats_matieres.reduce(function (a, v) { return a + (v || 0); }, 0);
    var ca = y.monthly.ca.reduce(function (a, v) { return a + (v || 0); }, 0);
    var pAch = ach, pCA = ca;
    if (mp < 12 && mp > 0) { pAch = (ach / mp) * 12; pCA = (ca / mp) * 12; }
    return { label: (mp < 12 ? yk + ' (proj.)' : yk), achats: pAch, ratio: pCA > 0 ? pAch / pCA : null };
  });
  var maxA = Math.max.apply(null, rows.map(function (r) { return r.achats; }).concat([1]));
  wrap.innerHTML = rows.map(function (r) {
    var cls = 'green';
    if (r.ratio !== null) { if (r.ratio > C.RATIO_ALERTE) cls = 'red'; else if (r.ratio > C.RATIO_CIBLE) cls = 'orange'; }
    var w = Math.max(4, Math.round(r.achats / maxA * 100));
    return '<div class="trend-row">' +
      '<div class="trend-year">' + r.label + '</div>' +
      '<div class="trend-track"><div class="trend-bar ' + cls + '" style="width:' + w + '%"></div></div>' +
      '<div class="trend-val">' + fmtEUR(r.achats) + '</div>' +
      '<div class="trend-badge ' + cls + '">' + (r.ratio !== null ? fmtPct(r.ratio, 1) : '—') + '</div>' +
    '</div>';
  }).join('');
};

// The arc retains the historical 0–80% scale; the label shows the actual rate.
function _renderMarginRateChart(rate) {
  var host = document.getElementById('bloc-taux');
  if (!host) return;
  var label = rate >= C.TAUX_OBJ ? 'objectif atteint' : 'objectif ' + fmtPct(C.TAUX_OBJ, 0);
  var description = 'Taux de marge brute : ' + fmtPct(rate, 1) + ', ' + label;
  if (!host.querySelector('#chart-margin-rate')) host.innerHTML = '<div class="ratio-sub"><div class="margin-rate-chart" id="chart-margin-rate" role="img" aria-label="' + esc(description) + '"></div></div>';
  var style = getComputedStyle(host);
  document.getElementById('chart-margin-rate').setAttribute('aria-label', description);
  _makeEChartGauge('chart-margin-rate', {
    min:0, max:80, pointer:{ show:false },
    axisLine:{ roundCap:true, lineStyle:{ width:17, color:[[1, style.getPropertyValue('--border-strong').trim()]] } },
    progress:{ show:true, roundCap:true, width:17, itemStyle:{ color:'#7C5AD6' } },
    data:[{ value:Math.max(0, Math.min(80, rate * 100)), name:label }]
  }, 'Taux actuel : ' + fmtPct(rate, 1) + '<br>Objectif : ' + fmtPct(C.TAUX_OBJ, 1) + '<br>Échelle : 0 à 80 %', rate);
}

// ---- Refonte carte "Santé financière" : barre de composition (trésorerie = position nette + dettes) ----
function renderSante(data, cur) {
  var wrap = document.getElementById('bloc-sante');
  var sante = data.sante;
  if (!sante) {
    if (charts['chart-financial-health']) { charts['chart-financial-health'].destroy(); delete charts['chart-financial-health']; }
    wrap.innerHTML = ''; return;
  }
  var cy = data.years[cur.year];
  var ytdK = function (k) { return cy.monthly[k].reduce(function (a, v) { return a + (v || 0); }, 0); };
  // Résultat = Marge brute − charges de fonctionnement − contribution coop − rémunérations.
  // (Les frais km sont un sous-compte des charges de fonctionnement : déjà comptés dedans.)
  var margeNette = cur.ytd_mb - ytdK('charges_fonct') - ytdK('contribution_coop') - ytdK('remunerations');
  var mn_cls = margeNette >= 0 ? 'accent-green' : 'accent-red';
  var dsoRatio = cur.ytd_ca > 0 ? (sante.creances_clients / cur.ytd_ca) : null;
  var creances_cls = 'accent-orange';
  if (dsoRatio !== null && dsoRatio > 0.25) creances_cls = 'accent-red';
  var tva = (sante.dettes_tva != null) ? sante.dettes_tva : Math.max(0, sante.tva_a_payer || 0);
  var dFourn = sante.dettes_fournisseurs || 0, dSoc = sante.dettes_sociales_fiscales || 0, dAcc = sante.dettes_acomptes_clients || 0;
  var paymentSource = data.revenue_distribution || data.margin_distribution || data.mb_distribution || {};
  var paymentDetails = paymentSource.payment_details || null;
  var advanceClients = paymentDetails && Array.isArray(paymentDetails.advances) ? paymentDetails.advances : [];
  var receivableClients = paymentDetails && Array.isArray(paymentDetails.receivables) ? paymentDetails.receivables : [];
  // La Balance ne donne qu'un solde global 4191/4712. On ne montre un client que
  // si les acomptes Pièces permettent un rapprochement exact et non ambigu.
  function advanceMatches(items, total) {
    var target = Math.round(Math.max(0, total) * 100);
    var maxCandidates = 6;
    if (!target) return { solutions: [], truncated: false };
    var matches = { 0: { solutions: [[]], truncated: false } };
    items.forEach(function (item, index) {
      var amount = Math.round(item.amount * 100);
      var sums = Object.keys(matches).map(Number).sort(function (a, b) { return b - a; });
      sums.forEach(function (sum) {
        var next = sum + amount;
        if (next > target || !matches[sum]) return;
        if (!matches[next]) matches[next] = { solutions: [], truncated: false };
        matches[sum].solutions.forEach(function (solution) {
          if (matches[next].solutions.length < maxCandidates) matches[next].solutions.push(solution.concat([index]));
          else matches[next].truncated = true;
        });
        if (matches[sum].truncated) matches[next].truncated = true;
      });
    });
    var found = matches[target];
    return found ? { solutions: found.solutions.map(function (solution) { return solution.map(function (index) { return items[index]; }); }), truncated: found.truncated } : { solutions: [], truncated: false };
  }
  var advanceMatchesFound = advanceMatches(advanceClients, dAcc);
  var matchedAdvanceClients = advanceMatchesFound.solutions.length === 1 ? advanceMatchesFound.solutions[0] : [];
  var dexpl = tva + dFourn + dSoc + dAcc;
  var cca = -(sante.comptes_courants_associes || 0);
  var cca_cls = cca < 0 ? 'accent-red' : 'accent-blue';
  var treso = sante.tresorerie_totale;
  var position = treso - dexpl;
  var asOfDate = sante.as_of ? new Date(sante.as_of).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  var detailLines = [
    { label: 'TVA à reverser', amount: tva }, { label: 'Fournisseurs', amount: dFourn },
    { label: 'Dettes sociales / fiscales', amount: dSoc }, { label: 'Acomptes clients reçus', amount: dAcc, detail: advanceMatchesFound.solutions.length ? 'advances' : null }
  ].filter(function (l) { return Math.abs(l.amount) > 0.5; });

  var chartDescription = 'Trésorerie ' + fmtEUR(treso) + ' = Position nette ' + fmtEUR(position) + ' + Dettes exigibles ' + fmtEUR(dexpl);

  // Résultat même période N-1 -> badge de variation
  var _refYr = cur.reference_year, _py = _refYr ? data.years[_refYr] : null, _n = cur.mois_renseignes, _rN1 = null;
  if (_py) {
    var _sk = function (k) { return _py.monthly[k].slice(0, _n).reduce(function (a, v) { return a + (v || 0); }, 0); };
    _rN1 = _sk('marge_brute') - _sk('charges_fonct') - _sk('contribution_coop') - _sk('remunerations');
  }
  var _delta = (_rN1 !== null) ? (margeNette - _rN1) : null;
  var resultatPill = '';
  if (_delta !== null) {
    var _up = _delta >= 0;
    var _txt = (_rN1 > 0) ? fmtPct(Math.abs(_delta) / _rN1, 1) : fmtEUR(Math.abs(_delta)); // % si base N-1 positive, sinon montant
    resultatPill = '<span class="kpi-pill ' + (_up ? 'up' : 'down') + '"><span class="tri">' + (_up ? '▲' : '▼') + '</span>' + _txt + '</span>';
  }
  // Le comparatif N-1 est à la maille mois (jan → dernier mois renseigné), pas au jour du dépôt du fichier
  var resultatSub = (_rN1 !== null && _n > 0) ? 'vs ' + fmtEUR(_rN1) + ' (jan\u2013' + MONTH_NAMES[_n - 1].toLowerCase() + ' ' + _refYr + ')' : 'Reste après charges, coop, salaire, km';
  function detailDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function customerModalRows(items, kind) {
    return items.map(function (item) {
      var docs = item.documents || [];
      var due = kind === 'receivables' ? docs.map(function (doc) { return doc.due_date; }).filter(Boolean).sort()[0] : null;
      var sub = kind === 'receivables'
        ? (due ? 'Échéance ' + detailDate(due) : docs.length + ' facture' + (docs.length > 1 ? 's' : ''))
        : docs.length + ' acompte' + (docs.length > 1 ? 's' : '') + ' encaissé' + (docs.length > 1 ? 's' : '');
      return { label: item.client + ' · ' + sub, amount: item.amount };
    });
  }
  var advancesModal;
  if (advanceMatchesFound.solutions.length > 1) {
    advancesModal = {
      title: 'Rapprochements d’acomptes possibles',
      subtitle: 'Combinaisons déduites par montant avec le solde Balance' + (advanceMatchesFound.truncated ? ' · au moins 6 hypothèses' : ''),
      rows: advanceMatchesFound.solutions.map(function (solution, index) { return { label: 'Hypothèse ' + (index + 1) + ' · ' + solution.map(function (item) { return item.client; }).join(' + '), amount: dAcc }; }),
      total: null, totalLabel: ''
    };
  } else {
    advancesModal = { title: 'Acompte client à honorer', subtitle: 'Rapprochement automatique avec le solde Balance — à vérifier', rows: customerModalRows(matchedAdvanceClients, 'advances'), total: dAcc, totalLabel: 'Solde d’acomptes Balance' };
  }
  var customerModalData = {
    advances: advancesModal,
    receivables: { title: 'Impayés clients', subtitle: 'Factures confirmées avec un solde « En attente » positif', rows: customerModalRows(receivableClients, 'receivables'), total: receivableClients.reduce(function (sum, item) { return sum + item.amount; }, 0), totalLabel: 'Total des impayés dans l’export' }
  };

  var kpis =
    '<div class="kpi ' + cca_cls + '">' +
      '<div class="kpi-top"><span class="kpi-ico">' + ICON.reserve + '</span><div class="kpi-label">Compte courant associé</div></div>' +
      '<div class="kpi-value">' + fmtEUR(cca) + '</div>' +
      '<div class="kpi-sub">Tes réserves dans la scop</div>' +
    '</div>' +
    '<div class="kpi ' + creances_cls + '">' +
      '<div class="kpi-top"><span class="kpi-ico">' + ICON.receipt + '</span><div class="kpi-label">Créances clients</div></div>' +
      '<div class="kpi-value">' + fmtEUR(sante.creances_clients) + '</div>' +
      '<div class="kpi-sub">' + (dsoRatio !== null ? fmtPct(dsoRatio, 0) + ' du CA cumulé · à relancer si vieux' : 'à relancer si vieux') + '</div>' +
      (receivableClients.length ? '<button type="button" class="sante-detail-link" data-customer-detail="receivables">Détail des impayés →</button>' : '') +
    '</div>' +
    '<div class="kpi ' + mn_cls + '">' +
      '<div class="kpi-top"><span class="kpi-ico">' + ICON.trending + '</span><div class="kpi-label">Résultat</div></div>' +
      '<div class="kpi-main"><div class="kpi-value">' + fmtEUR(margeNette) + '</div>' + resultatPill + '</div>' +
      '<div class="kpi-sub">' + resultatSub + '</div>' +
    '</div>';

  var detailHTML = detailLines.map(function (l) {
    var link = l.detail ? '<button type="button" class="sante-detail-link" data-customer-detail="' + l.detail + '">' + (advanceMatchesFound.solutions.length > 1 ? 'Voir les rapprochements possibles →' : 'Voir le rapprochement →') + '</button>' : '';
    return '<div class="sd-row"><span>' + l.label + '</span><span class="sd-eur">' + fmtEUR(l.amount) + '</span></div>' + link;
  }).join('');
  var detailBlock = detailLines.length
    ? '<div class="sante-detail"><button type="button" class="sante-detail-toggle">Détail des dettes exigibles →</button><div class="sante-detail-body" style="display:none">' + detailHTML + '</div></div>'
    : '';
  var acomptesAlert = dAcc > 0.5
    ? '<div class="sante-acomptes-alert"><div><strong>Acomptes clients à honorer</strong><span>Dette envers tes clients tant que les prestations ne sont pas réalisées ou facturées.</span></div><b>' + fmtEUR(dAcc) + '</b></div>'
    : '';

  wrap.innerHTML =
    '<div class="card sante-card">' +
      '<h3>Santé financière<span class="sp-help" data-tip="Photo de ta trésorerie à la date de la balance : ce qui est vraiment à toi (position nette) une fois les dettes exigibles retirées, plus tes réserves, créances et résultat.">?</span>' +
        (asOfDate !== '—' ? '<span class="sante-asof">Balance arrêtée au ' + asOfDate + '</span>' : '') +
      '</h3>' +
      '<div class="sante-oneline">' +
        '<div class="sante-gauge">' +
          '<div class="pn-top">' +
            '<div><div class="pn-label">Trésorerie</div><div class="pn-value">' + fmtEUR(treso) + '</div></div>' +
          '</div>' +
          '<div class="financial-health-chart"><canvas id="chart-financial-health" role="img" aria-label="' + esc(chartDescription) + '">' + esc(chartDescription) + '</canvas></div>' +
          '<div class="pn-legend">' +
            '<span class="pn-leg"><span class="pn-dot pos"></span>Position nette <strong>' + fmtEUR(position) + '</strong></span>' +
            '<span class="pn-leg"><span class="pn-dot debt"></span>Dettes exigibles <strong>' + fmtEUR(dexpl) + '</strong></span>' +
          '</div>' +
          acomptesAlert +
          detailBlock +
        '</div>' +
        kpis +
      '</div>' +
    '</div>';
  _renderFinancialHealthChart(treso, position, dexpl);
  var _tog = wrap.querySelector('.sante-detail-toggle');
  if (_tog) _tog.addEventListener('click', function () {
    var body = wrap.querySelector('.sante-detail-body');
    var open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    _tog.textContent = 'Détail des dettes exigibles ' + (open ? '→' : '↑');
  });
  Array.prototype.forEach.call(wrap.querySelectorAll('[data-customer-detail]'), function (button) {
    button.addEventListener('click', function () {
      var kind = button.getAttribute('data-customer-detail');
      var modal = customerModalData[kind];
      if (!modal || !modal.rows.length) return;
      openDetailModal(modal.title, modal.subtitle, modal.rows, modal.total, modal.totalLabel);
    });
  });
};

function _renderFinancialHealthChart(cash, net, debt) {
  var canvas = document.getElementById('chart-financial-health');
  var style = getComputedStyle(canvas);
  // Preserve the composition view: negative net positions remain visible in
  // the amounts and tooltip, while the bar only represents positive amounts.
  var values = [Math.max(0, net), Math.max(0, debt)];
  makeChart('chart-financial-health', {
    type:'bar',
    data:{ labels:['Trésorerie'], datasets:values.map(function (value, i) {
      var first = i === 0 || values[0] === 0;
      var last = i === 1 || values[1] === 0;
      return { label:i === 0 ? 'Position nette' : 'Dettes exigibles', data:[value],
        backgroundColor:i === 0 ? '#7C5AD6' : style.getPropertyValue('--orange').trim(),
        stack:'cash', barThickness:20, borderSkipped:false,
        borderRadius:{ topLeft:first ? 7 : 0, bottomLeft:first ? 7 : 0, topRight:last ? 7 : 0, bottomRight:last ? 7 : 0 }
      };
    }) },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ display:false }, tooltip:{ displayColors:false, callbacks:{
        title:function () { return 'Santé financière'; },
        label:function (context) { return context.datasetIndex === 0 ? [
          'Trésorerie : ' + fmtEUR(cash), 'Position nette : ' + fmtEUR(net), 'Dettes exigibles : ' + fmtEUR(debt)
        ] : null; }
      } } },
      scales:{ x:{ display:false, stacked:true, min:0, max:Math.max(cash, debt, values[0] + values[1], 1) }, y:{ display:false, stacked:true } }
    }
  });
}

// ---- Module unifié : KPI, répartition et comparaison N-1 / N ----
function renderPerformanceKpis(cy, py, cur) {
  var wrap = document.getElementById('performance-kpis');
  if (!wrap) return;
  var n = cur.mois_renseignes;
  function ytd(y, key) { return y ? y.monthly[key].reduce(function (a, v) { return a + (v || 0); }, 0) : null; }
  function same(y, key) { return y ? y.monthly[key].slice(0, n).reduce(function (a, v) { return a + (v || 0); }, 0) : null; }
  var ca = ytd(cy, 'ca'), prevCA = same(py, 'ca');
  var result = ytd(cy, 'ca') - ytd(cy, 'achats_matieres') - ytd(cy, 'remunerations') - ytd(cy, 'charges_fonct') - ytd(cy, 'contribution_coop');
  var prevResult = py ? same(py, 'ca') - same(py, 'achats_matieres') - same(py, 'remunerations') - same(py, 'charges_fonct') - same(py, 'contribution_coop') : null;
  var costs = ca - result, prevCosts = prevCA === null || prevResult === null ? null : prevCA - prevResult;
  function pctDelta(now, before) { return before ? (now - before) / before : null; }
  function kpi(label, value, delta, inverse) {
    var good = delta === null ? '' : ((inverse ? delta < 0 : delta > 0) ? '' : ' bad');
    var sign = delta === null ? '' : (delta > 0 ? '↑ ' : (delta < 0 ? '↓ ' : '→ '));
    return '<div class="performance-kpi"><div class="label">' + label + '</div><div class="value">' + fmtEUR(value) + '</div><div class="delta' + good + '">' + (delta === null ? 'Comparaison indisponible' : sign + fmtPct(Math.abs(delta), 1) + ' · vs N-1') + '</div></div>';
  }
  wrap.innerHTML = kpi("Chiffre d'affaires", ca, pctDelta(ca, prevCA), false) + kpi('Coûts totaux', costs, pctDelta(costs, prevCosts), true) + kpi('Résultat', result, pctDelta(result, prevResult), false);
}

function renderTableCmp(cy, py, cur) {
  var wrap = document.getElementById('bloc4');
  var n = cur.mois_renseignes;
  function ytd(y, key) { return y ? y.monthly[key].reduce(function (a, v) { return a + (v || 0); }, 0) : null; }
  function same(y, key) { return y ? y.monthly[key].slice(0, n).reduce(function (a, v) { return a + (v || 0); }, 0) : null; }
  function result(y, samePeriod) { if (!y) return null; var get = samePeriod ? same : ytd; return get(y, 'ca') - get(y, 'achats_matieres') - get(y, 'remunerations') - get(y, 'charges_fonct') - get(y, 'contribution_coop'); }
  function pill(value, favorableWhenLower, points) {
    if (value === null || value === undefined || isNaN(value)) return '—';
    var good = favorableWhenLower ? value < 0 : value > 0;
    var bad = favorableWhenLower ? value > 0 : value < 0;
    var cls = good ? 'pos' : (bad ? 'neg' : 'zero');
    var text = points ? fmtDeltaPts(value) : fmtDelta(value);
    return '<span class="cmp-pill ' + cls + '">' + text + '</span>';
  }
  function catCell(row, share) {
    return '<div class="cmp-post"><i class="cmp-dot" style="background:' + row.color + '"></i>' + row.label + '</div><div class="cmp-gauge"><span style="width:' + share + '%;background:' + row.color + '"></span></div>';
  }
  var rows = [
    { label:'Achats matières', key:'achats_matieres', color:COLORS.red, cost:true },
    { label:'Salaires', key:'remunerations', color:COLORS.blue, cost:true },
    { label:'Charges de fonctionnement', key:'charges_fonct', color:COLORS.orange, cost:true },
    { label:'Frais kilométriques', key:'frais_km', color:COLORS.gray, cost:true },
    { label:'Contribution coopérative', key:'contribution_coop', color:COLORS.teal, cost:true },
    { label:'Résultat restant', calc:true, color:COLORS.green, cost:false }
  ];
  var pyYear = py ? String(parseInt(cur.year) - 1) : 'N-1';
  var dateStr = DATA && DATA.file_mtime_iso ? new Date(DATA.file_mtime_iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
  var ca = ytd(cy, 'ca'), prevCA = same(py, 'ca'), mb = ytd(cy, 'marge_brute'), prevMB = same(py, 'marge_brute');
  var html = '<table class="cmp"><thead><tr><th>Poste</th><th>' + cur.year + ' · au ' + dateStr + '</th><th>' + pyYear + ' même période</th><th>Écart</th></tr></thead><tbody>';
  rows.forEach(function (row) {
    var now = row.calc ? result(cy, false) : ytd(cy, row.key);
    var before = row.calc ? result(py, true) : same(py, row.key);
    var delta = now === null || before === null ? null : now - before;
    var share = ca ? Math.max(0, Math.round(now / ca * 100)) : 0;
    html += '<tr><td>' + catCell(row, share) + '</td><td>' + fmtEUR(now) + (now !== null ? '<br><span class="muted-col">' + share + ' % du CA</span>' : '') + '</td><td>' + fmtEUR(before) + '</td><td>' + pill(delta, row.cost, false) + '</td></tr>';
  });
  var costs = ca - result(cy, false), prevCosts = prevCA === null ? null : prevCA - result(py, true);
  var taux = ca ? mb / ca : null, prevTaux = prevCA ? prevMB / prevCA : null;
  var alerts = cy.monthly.marge_brute.filter(function (v) { return v !== null && v < C.MB_MIN; }).length;
  var prevAlerts = py ? py.monthly.marge_brute.slice(0, n).filter(function (v) { return v !== null && v < C.MB_MIN; }).length : null;
  function summary(label, now, before, lowerIsBetter, formatter, isPoints) {
    var delta = now === null || before === null ? null : now - before;
    return '<tr class="cmp-summary"><td>' + label + '</td><td>' + formatter(now) + '</td><td>' + formatter(before) + '</td><td>' + pill(delta, lowerIsBetter, isPoints) + '</td></tr>';
  }
  html += '<tr class="cmp-summary-title"><td colspan="4">Indicateurs de synthèse</td></tr>';
  html += summary("Chiffre d'affaires", ca, prevCA, false, fmtEUR, false);
  html += summary('Marge brute', mb, prevMB, false, fmtEUR, false);
  html += summary('Taux de marge brute', taux, prevTaux, false, function (v) { return fmtPct(v, 1); }, true);
  html += summary('Coûts totaux', costs, prevCosts, true, fmtEUR, false);
  html += summary('Résultat', result(cy, false), result(py, true), false, fmtEUR, false);
  html += summary('Mois sous seuil min.', alerts, prevAlerts, true, function (v) { return v === null ? '—' : v + ' mois'; }, false);
  wrap.innerHTML = html + '</tbody></table>';
}

// ---- Barres empilées horizontales en valeur absolue ----
function renderRepartYears(cur, years) {
  var canvas = document.getElementById('chart-repart-years');
  if (!canvas) return;
  var n = cur.mois_renseignes;
  var order = Object.keys(years).sort().reverse(); // année la plus récente en haut
  function same(yObj, k) { return yObj.monthly[k].slice(0, n).reduce(function (a, v) { return a + (v || 0); }, 0); }
  var cats = [
    { label: 'Achats matières', col: COLORS.red, val: function (y) { return same(y, 'achats_matieres'); } },
    { label: 'Salaire', col: COLORS.blue, val: function (y) { return same(y, 'remunerations'); } },
    { label: 'Charges de fonct.', col: COLORS.orange, val: function (y) { return same(y, 'charges_fonct') - same(y, 'frais_km'); } },
    { label: 'Frais km', col: COLORS.gray, val: function (y) { return same(y, 'frais_km'); } },
    { label: 'Contribution coop.', col: COLORS.teal, val: function (y) { return same(y, 'contribution_coop'); } },
    { label: 'Résultat', col: COLORS.green, val: function (y) { return same(y, 'ca') - same(y, 'achats_matieres') - same(y, 'remunerations') - same(y, 'charges_fonct') - same(y, 'contribution_coop'); } }
  ];
  var moisLbl = (MONTH_NAMES[n - 1] || '').toLowerCase();
  var labels = order.map(function (yk) { return yk === cur.year ? yk + ' (à date)' : yk + ' (jan-' + moisLbl + ')'; });
  // Matrice en euros : la longueur de chaque barre représente le CA de la période.
  var raw = order.map(function (yk) { return cats.map(function (c) { return c.val(years[yk]); }); });
  var datasets = cats.map(function (c, ci) {
    return {
      label: c.label, backgroundColor: c.col, borderWidth: 0, borderRadius: 3,
      data: order.map(function (yk, yi) { return Math.max(0, raw[yi][ci]); }),
      _raw: order.map(function (yk, yi) { return raw[yi][ci]; })
    };
  });
  makeChart('chart-repart-years', {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, beginAtZero: true, ticks: { callback: function (v) { return Math.round(v / 1000) + ' k€'; } }, grid: { color: CHART_GRID } },
        y: { stacked: true, grid: { display: false }, ticks: { font: { weight: '800', size: 13 } } }
      },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var raw = ctx.dataset._raw ? ctx.dataset._raw[ctx.dataIndex] : null;
              return ' ' + ctx.dataset.label + ' : ' + fmtEUR(raw);
            }
          }
        }
      }
    }
  });
}

// ---- Thème clair / sombre (manuel + mémorisé) ----
var THEME_KEY = 'cabestan_dashboard_theme';
var SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>';
var MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function effectiveDark() {
  var t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}
// Recalcule les couleurs de graphes selon le thème courant et réapplique les défauts Chart.js
function applyChartTheme() {
  DARK = _computeDark();
  CHART_TEXT = DARK ? '#9d97a9' : '#6d6779';
  CHART_GRID = DARK ? 'rgba(255,255,255,0.05)' : 'rgba(40,30,60,0.06)';
  CHART_TOOLTIP_BG = DARK ? '#2a2536' : '#2b2536';
  if (window.Chart) {
    Chart.defaults.color = CHART_TEXT;
    Chart.defaults.borderColor = CHART_GRID;
    Chart.defaults.plugins.tooltip.backgroundColor = CHART_TOOLTIP_BG;
    try { if (Chart.defaults.scale && Chart.defaults.scale.grid) Chart.defaults.scale.grid.color = CHART_GRID; } catch (e) {}
  }
}
function updateThemeIcon() {
  var btn = document.getElementById('toggle-theme');
  if (btn) btn.innerHTML = effectiveDark() ? SUN_SVG : MOON_SVG; // en sombre -> propose le soleil, et inversement
}
function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
  applyChartTheme();
  updateThemeIcon();
  if (LAST_DATA) renderParsed(LAST_DATA); // redessine les graphes avec les nouvelles couleurs
}
document.getElementById('toggle-theme').addEventListener('click', function () {
  setTheme(effectiveDark() ? 'light' : 'dark');
});

// Bascule accueil / dashboard
function showDashboard() {
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('dashboard-root').style.display = 'block';
  document.getElementById('change-file').style.display = 'inline-flex';
  var err = document.getElementById('error'); if (err) err.style.display = 'none';
}
function showWelcome() {
  document.getElementById('dashboard-root').style.display = 'none';
  document.getElementById('welcome').style.display = 'block';
  document.getElementById('change-file').style.display = 'none';
}
function showError(e) {
  var msg = (e && e.message) ? e.message : String(e);
  var we = document.getElementById('welcome-err');
  if (document.getElementById('welcome').style.display !== 'none') {
    we.textContent = '⚠ ' + msg; we.style.display = 'block';
  } else {
    var err = document.getElementById('error');
    if (err) { err.textContent = 'Erreur : ' + msg; err.style.display = 'block'; }
  }
}

function hideWelcomeErr() { var we = document.getElementById('welcome-err'); if (we) we.style.display = 'none'; }

// Persistance locale des données (pour ne pas re-déposer les fichiers à chaque ouverture)
function saveData(data) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify({
      years: data.years, labels_missing: data.labels_missing, charges_detail: data.charges_detail,
      revenue_distribution: data.revenue_distribution, margin_distribution: data.margin_distribution, mb_distribution: data.mb_distribution,
      sante: data.sante, sante_error: data.sante_error,
      file_mtime_iso: data.file_mtime_iso, res_name: data.res_name, bal_name: data.bal_name, pieces_name: data.pieces_name,
      res_export_iso: data.res_export_iso, bal_export_iso: data.bal_export_iso, pieces_export_iso: data.pieces_export_iso
    }));
  } catch (e) { /* quota / mode privé -> on ignore */ }
}
function loadSavedData() {
  try {
    var raw = localStorage.getItem(DATA_KEY);
    if (!raw) return null;
    var d = JSON.parse(raw);
    if (d && d.years && Object.keys(d.years).length) return d;
  } catch (e) { /* données corrompues */ }
  return null;
}
function clearSavedData() { try { localStorage.removeItem(DATA_KEY); } catch (e) {} }

// Déduit la date/heure d'export Louty du nom de fichier : ..._aammjj_hhmmss.xlsx
function parseExportDate(name) {
  var m = /_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.xlsx$/i.exec(name || '');
  if (!m) return null;
  var d = new Date(2000 + (+m[1]), (+m[2]) - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
         ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Affiche dans la barre du haut la date d'export Louty de chaque fichier (déduite du nom).
// Les dates sont re-dérivées du nom si absentes (données mémorisées avant cette fonctionnalité).
function updateDataStatus(data) {
  if (!data.res_export_iso && data.res_name) data.res_export_iso = parseExportDate(data.res_name);
  if (!data.bal_export_iso && data.bal_name) data.bal_export_iso = parseExportDate(data.bal_name);
  var ds = document.getElementById('ds-date');
  var lab = document.getElementById('ds-label');
  var dsBal = document.getElementById('ds-bal');
  var box = document.getElementById('data-status');
  var iso = data.res_export_iso || data.file_mtime_iso;
  if (ds && iso) ds.textContent = fmtDateTime(iso);
  if (lab) lab.textContent = data.res_export_iso ? 'Résultat d\'Activité exporté le' : 'Généré le';
  if (dsBal) {
    if (data.bal_export_iso) { dsBal.textContent = 'Balance exportée le ' + fmtDateTime(data.bal_export_iso); dsBal.style.display = ''; }
    else { dsBal.style.display = 'none'; }
  }
  if (box) {
    box.title = 'Dates d\'export Louty déduites du nom de fichier · données mémorisées sur cet ordinateur.';
    box.style.display = 'inline-flex';
  }
}

// Avertit si des postes attendus manquent dans le fichier RES
// (sinon les indicateurs concernés affichent 0 sans que rien ne le signale).
function updateLabelsWarning(data) {
  var host = document.getElementById('dashboard-root');
  var el = document.getElementById('labels-warn');
  var missing = data.labels_missing || [];
  if (!missing.length) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'labels-warn'; el.className = 'error'; el.style.display = 'block';
    host.insertBefore(el, host.firstChild);
  }
  var noms = missing.map(function (k) { return (window.CabestanParser && CabestanParser.TARGET_LABELS[k]) || k; });
  el.textContent = "⚠ Postes introuvables dans le Résultat d'Activité : " + noms.join(', ') +
    ". Les indicateurs correspondants restent à 0 — vérifie l'export Louty (libellés renommés ou export partiel).";
}

// Rend le dashboard à partir d'un objet data (issu du parser)
function renderParsed(data) {
  try {
    LAST_DATA = data;
    loadPlan(data);
    applyPlanToCharts();
    var current = computeSnapshot(data);
    data.snapshot = { current: current, previous: null, updated_at: data.file_mtime_iso };
    showDashboard();
    updateLabelsWarning(data);
    render(data);
    if (!data.sante) injectSanteUpload(data.sante_error); // pas de BAL -> zone de dépôt à la place du vide
    updateDataStatus(data);
    saveData(data);
  } catch (e) { showError(e); throw e; }
}

// Carte "Santé financière" en attente de Balance : zone de dépôt intégrée
function injectSanteUpload(errMsg) {
  var wrap = document.getElementById('bloc-sante');
  if (!wrap) return;
  wrap.innerHTML =
    '<div class="card sante-card">' +
      '<h3>Santé financière</h3>' +
      '<div class="sante-empty"><div class="se-drop" id="bal-drop">' +
        '<div class="se-ico">' + UPLOAD_SVG + '</div>' +
        '<div class="se-title">Ajoute ta Balance Analytique</div>' +
        '<div class="se-sub">Dépose <code>BAL_A_Balance Analytique</code> ici pour afficher trésorerie, dettes et position nette.<br>Téléchargeable dans Louty › <strong>Rapports de gestion</strong>.</div>' +
        '<button type="button" class="btn primary" id="bal-browse">Choisir le fichier Balance</button>' +
        '<input type="file" id="bal-input" accept=".xlsx" style="display:none">' +
        (errMsg ? '<div class="welcome-err" style="display:block;margin-top:14px">⚠ ' + esc(errMsg) + '</div>' : '') +
      '</div></div>' +
    '</div>';
  var drop = document.getElementById('bal-drop');
  var inp = document.getElementById('bal-input');
  document.getElementById('bal-browse').addEventListener('click', function (e) { e.stopPropagation(); inp.click(); });
  drop.addEventListener('click', function () { inp.click(); });
  inp.addEventListener('change', function () { if (inp.files.length) ingest(inp.files); });
  ['dragenter', 'dragover'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.add('drag'); });
  });
  ['dragleave', 'drop'].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drag'); });
  });
  drop.addEventListener('drop', function (e) { var dt = e.dataTransfer; if (dt && dt.files && dt.files.length) ingest(dt.files); });
}

// Détecte si un classeur ressemble à un RES (feuille Rapport avec en-têtes de mois)
function looksLikeRES(wb) {
  if (!wb.Sheets['Rapport']) return false;
  var rows = CabestanParser.sheetToMatrix(XLSX, wb.Sheets['Rapport']);
  if (rows.length < 4) return false;
  var header = rows[2] || [];
  var re = /^(janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.?-(\d{2})$/i;
  return header.some(function (v) { return v != null && re.test(String(v).trim()); });
}
function looksLikePieces(wb) {
  for (var i = 0; i < wb.SheetNames.length; i++) {
    var ws = wb.Sheets[wb.SheetNames[i]];
    var header = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, raw: true })[0] || [];
    var has = function (name) { return header.some(function (v) { return String(v == null ? '' : v).trim() === name; }); };
    if (has('Type') && has('Date') && has('Client') && has('Montant H.T.') && has('Etat')) return true;
  }
  return false;
}

function readWorkbook(file) {
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array', cellDates: true, cellStyles: true });
        resolve({ name: file.name, wb: wb });
      } catch (e) { reject(new Error("Impossible de lire « " + file.name + " » : fichier Excel invalide.")); }
    };
    fr.onerror = function () { reject(new Error("Lecture impossible de « " + file.name + " ».")); };
    fr.readAsArrayBuffer(file);
  });
}

var dzFiles = document.getElementById('dz-files');
function setFileStatus(resName, balName, piecesName) {
  var lines = [];
  if (resName) lines.push('<div class="dz-file"><span class="ok">✓</span> RES : ' + esc(resName) + '</div>');
  if (balName) lines.push('<div class="dz-file"><span class="ok">✓</span> BAL : ' + esc(balName) + '</div>');
  if (piecesName) lines.push('<div class="dz-file"><span class="ok">✓</span> Pièces : ' + esc(piecesName) + '</div>');
  dzFiles.innerHTML = lines.join('');
}

// Classe les classeurs déposés en RES / BAL (par nom Louty puis par contenu)
function classifyBooks(books) {
  var resBook = null, balBook = null, piecesBook = null;
  books.forEach(function (b) {
    var up = b.name.toUpperCase();
    if (/BAL/.test(up) && !balBook) balBook = b;
    else if (/RES/.test(up) && !resBook) resBook = b;
    else if (/PI[ÈE]CES/.test(up) && !piecesBook) piecesBook = b;
  });
  books.forEach(function (b) {
    if (b === resBook || b === balBook || b === piecesBook) return;
    if (!resBook && looksLikeRES(b.wb)) resBook = b;
    else if (!piecesBook && looksLikePieces(b.wb)) piecesBook = b;
    else if (!balBook) balBook = b;
  });
  if (!resBook) {
    var cand = books.filter(function (b) { return looksLikeRES(b.wb); });
    if (cand.length) resBook = cand[0];
  }
  return { resBook: resBook, balBook: balBook, piecesBook: piecesBook };
}

// Un RES et ses exports complémentaires doivent toujours provenir du même instant.
// Lors d'un nouveau RES, ne jamais conserver les données facultatives du précédent
// import : elles seraient sinon affichées avec une période potentiellement différente.
function resetDependentImports(data) {
  [
    'revenue_distribution', 'margin_distribution', 'mb_distribution',
    'sante', 'sante_error',
    'bal_name', 'pieces_name', 'bal_export_iso', 'pieces_export_iso'
  ].forEach(function (key) { delete data[key]; });
}

// Point d'entrée unique : accepte RES et/ou BAL, dans n'importe quel ordre.
function ingest(fileList) {
  hideWelcomeErr();
  var files = Array.prototype.slice.call(fileList).filter(function (f) { return /\.xlsx$/i.test(f.name); });
  if (!files.length) { showError(new Error("Dépose un fichier .xlsx (l'export Louty).")); return; }
  Promise.all(files.map(readWorkbook)).then(function (books) {
    var c = classifyBooks(books);
    if (c.resBook) {
      // Nouveau Résultat d'Activité -> on (re)construit tout
      var data = CabestanParser.parseRES(XLSX, c.resBook.wb);
      resetDependentImports(data);
      if (!Object.keys(data.years).length) {
        throw new Error("Le fichier Résultat d'Activité ne contient aucune année exploitable (colonnes de mois introuvables dans la feuille « Rapport »).");
      }
      data.file_mtime_iso = new Date().toISOString();
      data.res_name = c.resBook.name;
      data.res_export_iso = parseExportDate(c.resBook.name);
      if (c.balBook) {
        try { data.sante = CabestanParser.parseBAL(XLSX, c.balBook.wb); data.bal_name = c.balBook.name; data.bal_export_iso = parseExportDate(c.balBook.name); }
        catch (e) { data.sante_error = e.message; }
      }
      if (c.piecesBook) {
        data.revenue_distribution = CabestanParser.parsePieces(XLSX, c.piecesBook.wb);
        data.pieces_name = c.piecesBook.name;
        data.pieces_export_iso = parseExportDate(c.piecesBook.name);
      }
      setFileStatus(c.resBook.name, c.balBook ? c.balBook.name : null, c.piecesBook ? c.piecesBook.name : null);
      renderParsed(data);
    } else if ((c.balBook || c.piecesBook) && LAST_DATA) {
      // Balance ou Pièces seul + un Résultat déjà chargé -> on enrichit les données existantes
      if (c.balBook) {
        try {
          LAST_DATA.sante = CabestanParser.parseBAL(XLSX, c.balBook.wb);
          LAST_DATA.bal_name = c.balBook.name;
          LAST_DATA.bal_export_iso = parseExportDate(c.balBook.name);
          delete LAST_DATA.sante_error;
        } catch (e) { throw new Error("Balance illisible : " + e.message); }
      }
      if (c.piecesBook) {
        LAST_DATA.revenue_distribution = CabestanParser.parsePieces(XLSX, c.piecesBook.wb);
        LAST_DATA.pieces_name = c.piecesBook.name;
        LAST_DATA.pieces_export_iso = parseExportDate(c.piecesBook.name);
      }
      setFileStatus(LAST_DATA.res_name || null, LAST_DATA.bal_name || null, LAST_DATA.pieces_name || null);
      renderParsed(LAST_DATA);
    } else {
      throw new Error("Commence par déposer le fichier Résultat d'Activité (RES_U_Résultat d'Activité). La Balance ou les Pièces seules ne suffisent pas à générer le tableau de bord.");
    }
  }).catch(function (e) { showError(e); });
}

// Drag & drop + parcourir (écran d'accueil)
var dz = document.getElementById('dropzone');
var fileInput = document.getElementById('file-input');
document.getElementById('browse-btn').addEventListener('click', function (ev) { ev.stopPropagation(); fileInput.click(); });
dz.addEventListener('click', function () { fileInput.click(); });
fileInput.addEventListener('change', function () { if (fileInput.files.length) ingest(fileInput.files); });
['dragenter', 'dragover'].forEach(function (ev) {
  dz.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.add('drag'); });
});
['dragleave', 'drop'].forEach(function (ev) {
  dz.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); dz.classList.remove('drag'); });
});
dz.addEventListener('drop', function (e) {
  var dt = e.dataTransfer; if (dt && dt.files && dt.files.length) ingest(dt.files);
});
// éviter que le navigateur ouvre le fichier si lâché à côté
['dragover', 'drop'].forEach(function (ev) {
  window.addEventListener(ev, function (e) { if (e.target === document.body || e.target.id === 'welcome') e.preventDefault(); });
});
document.getElementById('change-file').addEventListener('click', function () {
  // On garde LAST_DATA en mémoire pour pouvoir annuler et revenir au tableau de bord
  dzFiles.innerHTML = ''; fileInput.value = ''; hideWelcomeErr();
  document.getElementById('welcome-back').style.display = LAST_DATA ? 'inline-flex' : 'none';
  showWelcome();
});
document.getElementById('welcome-back').addEventListener('click', function () {
  if (LAST_DATA) showDashboard();
});

// Infobulles d'aide (pastilles "?") — positionnées en fixed pour ne pas être rognées
(function () {
  var tip = document.createElement('div');
  tip.id = 'help-tip';
  document.body.appendChild(tip);
  function place(el) {
    var txt = el.getAttribute('data-tip'); if (!txt) return;
    tip.textContent = txt; tip.style.display = 'block';
    var r = el.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8));
    var top = r.top - th - 8;
    if (top < 8) top = r.bottom + 8;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function hide() { tip.style.display = 'none'; tip._for = null; }
  document.addEventListener('mouseover', function (e) { var el = e.target.closest && e.target.closest('.sp-help'); if (el) place(el); });
  document.addEventListener('mouseout', function (e) { var el = e.target.closest && e.target.closest('.sp-help'); if (el && !tip._for) hide(); });
  // Barres du mini-graphe mensuel : montant au survol
  document.addEventListener('mouseover', function (e) { var el = e.target.closest && e.target.closest('.mbc-col'); if (el && el.getAttribute('data-tip')) place(el); });
  document.addEventListener('mouseout', function (e) { var el = e.target.closest && e.target.closest('.mbc-col'); if (el && !tip._for) hide(); });
  document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('.sp-help'); if (el) place(el); });
  document.addEventListener('focusout', function () { if (!tip._for) hide(); });
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('.sp-help');
    if (el) { e.preventDefault(); e.stopPropagation(); if (tip._for === el) hide(); else { place(el); tip._for = el; } }
    else if (tip._for) hide();
  });
  var spb = document.querySelector('.sp-body'); if (spb) spb.addEventListener('scroll', hide);
})();

// Mise à jour automatique : si le fichier hébergé est plus récent, on recharge la dernière version
var APP_VERSION = "20260722-191051";
function showUpdateBanner(base, v) {
  if (document.getElementById('update-banner')) return;
  var d = document.createElement('div');
  d.id = 'update-banner';
  d.innerHTML = 'Une nouvelle version du tableau de bord est disponible. <button type="button">Mettre à jour</button>';
  document.body.appendChild(d);
  d.querySelector('button').addEventListener('click', function () { location.replace(base + '?v=' + encodeURIComponent(v)); });
}
(function () {
  try {
    if (location.protocol === 'file:') return; // en local (double-clic) : pas de vérif réseau
    var base = location.href.split('#')[0].split('?')[0];
    fetch('version.txt?_=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (t) {
        if (!t) return;
        var v = t.trim();
        if (!v || v === APP_VERSION) return;
        var tried = null;
        try { tried = sessionStorage.getItem('cabestan_vupd'); } catch (e) {}
        if (tried === v) { showUpdateBanner(base, v); return; } // déjà tenté ce chargement -> on propose sans boucler
        try { sessionStorage.setItem('cabestan_vupd', v); } catch (e) {}
        location.replace(base + '?v=' + encodeURIComponent(v)); // recharge la version fraîche (contourne le cache)
      })
      .catch(function () {});
  } catch (e) {}
})();

// Init
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
applyChartTheme();   // aligne les couleurs Chart.js sur le thème (auto ou mémorisé)
updateThemeIcon();
loadSettings();
// Les objectifs ne sont plus demandés avant le premier export : le « Cap annuel »
// les initialise ensuite avec l'historique réel de l'activité.
if (lsGet(SETTINGS_KEY) === null) {
  saveSettings();
}
// Restauration automatique des dernières données mémorisées (plus besoin de re-déposer au refresh)
(function () {
  var saved = loadSavedData();
  if (saved) {
    try { renderParsed(saved); }
    catch (e) { clearSavedData(); showWelcome(); }
  }
})();

