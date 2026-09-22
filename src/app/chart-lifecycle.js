export const chartInstances = Object.create(null);
export const echartInstances = Object.create(null);

const INITIAL_DURATION = 900;
const UPDATE_DURATION = 600;
const ECHARTS_EASING = 'cubicOut';
const CHARTJS_EASING = 'easeOutCubic';

export function prefersReducedMotion() {
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function setChartTheme({ font, text, grid, tooltip }) {
  if (!window.Chart) return;
  const animate = !prefersReducedMotion();
  Chart.defaults.font.family = font;
  Chart.defaults.font.size = 12;
  Chart.defaults.font.weight = '600';
  Chart.defaults.color = text;
  Chart.defaults.borderColor = grid;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle = 'circle';
  Chart.defaults.plugins.legend.labels.boxWidth = 8;
  Chart.defaults.plugins.legend.labels.boxHeight = 8;
  Chart.defaults.plugins.legend.labels.padding = 18;
  Chart.defaults.plugins.legend.labels.font = { size: 12, weight: '700' };
  Chart.defaults.plugins.tooltip.backgroundColor = tooltip;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
  Chart.defaults.plugins.tooltip.bodyColor = 'rgba(255,255,255,0.85)';
  Chart.defaults.plugins.tooltip.titleFont = { size: 12.5, weight: '800', family: font };
  Chart.defaults.plugins.tooltip.bodyFont = { size: 12, weight: '600', family: font };
  Chart.defaults.plugins.tooltip.boxPadding = 6;
  Chart.defaults.plugins.tooltip.usePointStyle = true;
  Chart.defaults.animation = animate ? { duration: INITIAL_DURATION, easing: CHARTJS_EASING } : false;
  Chart.defaults.elements.bar.borderRadius = 7;
  Chart.defaults.elements.bar.borderSkipped = false;
  Chart.defaults.elements.point.radius = 2.5;
  Chart.defaults.elements.point.hoverRadius = 6;
  Chart.defaults.elements.line.tension = 0.4;
  Chart.defaults.elements.line.borderJoinStyle = 'round';
  Chart.defaults.elements.line.capBezierPoints = true;
  try {
    if (Chart.defaults.scale?.grid) {
      Chart.defaults.scale.grid.color = grid;
      Chart.defaults.scale.grid.drawTicks = false;
      Chart.defaults.scale.grid.tickLength = 8;
    }
    if (Chart.defaults.scale?.ticks) Chart.defaults.scale.ticks.padding = 8;
    if (Chart.defaults.scale?.border) Chart.defaults.scale.border.display = false;
  } catch (_) { /* optional Chart.js defaults */ }
}

export function makeChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return null;
  if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
  config.options ??= {};
  if (config.options.animation === undefined) {
    config.options.animation = prefersReducedMotion()
      ? false
      : { duration: INITIAL_DURATION, easing: CHARTJS_EASING };
  }
  const chart = new Chart(canvas.getContext('2d'), config);
  chartInstances[canvasId] = chart;
  return chart;
}

export function disposeChart(canvasId) {
  if (!chartInstances[canvasId]) return;
  chartInstances[canvasId].destroy();
  delete chartInstances[canvasId];
}

export function disposeEChart(id) {
  const entry = echartInstances[id];
  if (!entry) return;
  entry.observer.disconnect();
  entry.chart.dispose();
  delete echartInstances[id];
}

function echartOptions(buildOption, font) {
  const option = buildOption();
  const animate = !prefersReducedMotion();
  return {
    ...option,
    animation: animate,
    animationDuration: INITIAL_DURATION,
    animationEasing: ECHARTS_EASING,
    animationDurationUpdate: UPDATE_DURATION,
    animationEasingUpdate: ECHARTS_EASING,
    textStyle: { fontFamily: font, ...(option.textStyle || {}) },
  };
}

export function makeEChart(id, buildOption, font) {
  Object.keys(echartInstances).forEach((key) => {
    if (echartInstances[key].chart.getDom() !== document.getElementById(key)) disposeEChart(key);
  });
  const host = document.getElementById(id);
  if (!host || !window.LoutyECharts) return null;
  let entry = echartInstances[id];
  if (!entry) {
    const chart = LoutyECharts.init(host, null, {
      renderer: 'svg', width: host.clientWidth || 220, height: host.clientHeight || 140,
    });
    entry = { chart, buildOption };
    entry.observer = new ResizeObserver(() => {
      if (host.clientWidth && host.clientHeight &&
          (chart.getWidth() !== host.clientWidth || chart.getHeight() !== host.clientHeight)) {
        chart.resize({ width: host.clientWidth, height: host.clientHeight });
        chart.setOption(echartOptions(entry.buildOption, font));
      }
    });
    entry.observer.observe(host);
    echartInstances[id] = entry;
  }
  entry.buildOption = buildOption;
  entry.chart.setOption(echartOptions(buildOption, font), { notMerge: true });
  return entry.chart;
}
