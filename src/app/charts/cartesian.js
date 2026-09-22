// Chart.js views that share the dashboard's current colors, targets and formatters.
// Dynamic settings are read for each render so theme and cap edits stay in sync.
export function createCartesianCharts({
  MONTH_NAMES, COLORS, CHART_FONT, Chart, fmtEUR, fmtPct, makeChart, historicalPlanReference, getContext,
}) {
// Graphe fusionné : CA mensuel en barres empilées avec repères historiques discrets en arrière-plan.
function renderCAMB(cy, curYear, years) {
  const { C, DATA } = getContext();
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
  const { C } = getContext();
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

function renderAchatsCAChart(cy) {
  const { C } = getContext();
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

// ---- Barres empilées horizontales en valeur absolue ----
function renderRepartYears(cur, years) {
  const { CHART_GRID } = getContext();
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

  return { renderCAMB, renderTauxAnnuel, renderCumulChart, renderAchatsCAChart, renderRepartYears };
}
