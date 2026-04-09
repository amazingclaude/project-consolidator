// === Plotly.js chart builders ===

const COLORS = {
  blue: "#3b82f6", red: "#dc2626", green: "#16a34a",
  orange: "#d97706", grey: "#94a3b8", lightBlue: "#93c5fd",
};

function renderCpiSpiScatter(containerId, data) {
  const trace = {
    x: data.map(d => d.cpi).filter(v => v != null),
    y: data.map(d => d.spi).filter(v => v != null),
    text: data.filter(d => d.cpi != null && d.spi != null).map(d => d.name),
    mode: "markers+text", textposition: "top center",
    marker: { size: 12, color: COLORS.blue },
    textfont: { size: 9 },
    type: "scatter",
  };
  const layout = {
    title: "Portfolio CPI / SPI Analysis",
    xaxis: { title: "CPI", range: [0, 2] },
    yaxis: { title: "SPI", range: [0, 2] },
    shapes: [
      { type: "line", x0: 1, x1: 1, y0: 0, y1: 2, line: { dash: "dash", color: "gray", width: 1 } },
      { type: "line", x0: 0, x1: 2, y0: 1, y1: 1, line: { dash: "dash", color: "gray", width: 1 } },
      { type: "rect", x0: 0, y0: 0, x1: 1, y1: 1, fillcolor: "rgba(255,0,0,0.03)", line: { width: 0 } },
      { type: "rect", x0: 1, y0: 1, x1: 2, y1: 2, fillcolor: "rgba(0,200,0,0.03)", line: { width: 0 } },
    ],
    margin: { t: 40, b: 50, l: 50, r: 20 },
  };
  Plotly.newPlot(containerId, [trace], layout, { responsive: true });
}

function renderGanttChart(containerId, tasks, title) {
  const filtered = tasks.filter(t => t.start && t.finish);
  if (!filtered.length) { document.getElementById(containerId).innerHTML = '<div class="alert alert-info">No tasks with valid dates.</div>'; return; }

  const traces = [];
  filtered.forEach(t => {
    traces.push({
      x: [new Date(t.start), new Date(t.finish)],
      y: [t.name, t.name],
      mode: "lines", line: { width: 14, color: t.critical ? COLORS.red : COLORS.blue },
      name: t.name, showlegend: false,
      hovertemplate: `<b>${t.name}</b><br>Start: ${formatDate(t.start)}<br>Finish: ${formatDate(t.finish)}<extra></extra>`,
    });
  });

  const layout = {
    title: title || "Schedule",
    yaxis: { autorange: "reversed" },
    height: Math.max(400, filtered.length * 28),
    margin: { l: 200, r: 20, t: 40, b: 40 },
    showlegend: false,
  };
  Plotly.newPlot(containerId, traces, layout, { responsive: true });
}

function renderBaselineVsActualGantt(containerId, tasks, title) {
  const filtered = tasks.filter(t => t.start && t.finish);
  if (!filtered.length) { document.getElementById(containerId).innerHTML = '<div class="alert alert-info">No tasks with valid dates.</div>'; return; }

  const traces = [];
  // Current bars
  filtered.forEach(t => {
    traces.push({
      x: [new Date(t.start), new Date(t.finish)],
      y: [t.name, t.name],
      mode: "lines", line: { width: 14, color: COLORS.blue },
      showlegend: false,
      hovertemplate: `<b>${t.name}</b><br>Start: ${formatDate(t.start)}<br>Finish: ${formatDate(t.finish)}<extra></extra>`,
    });
  });
  // Baseline overlay
  filtered.filter(t => t.baseline_start && t.baseline_finish).forEach(t => {
    traces.push({
      x: [new Date(t.baseline_start), new Date(t.baseline_finish)],
      y: [t.name, t.name],
      mode: "lines", line: { width: 6, color: COLORS.red, dash: "dot" },
      showlegend: false,
      hovertemplate: `<b>${t.name} (Baseline)</b><br>Start: ${formatDate(t.baseline_start)}<br>Finish: ${formatDate(t.baseline_finish)}<extra></extra>`,
    });
  });

  const layout = {
    title: title || "Baseline vs Current",
    yaxis: { autorange: "reversed" },
    height: Math.max(400, filtered.length * 30),
    margin: { l: 200, r: 20, t: 40, b: 40 },
    showlegend: false,
  };
  Plotly.newPlot(containerId, traces, layout, { responsive: true });
}

function renderHorizontalBar(containerId, labels, values, title, colorScale) {
  const colors = values.map(v => {
    if (colorScale === "diverging") {
      return v >= 0 ? COLORS.green : COLORS.red;
    }
    return COLORS.blue;
  });
  const trace = {
    x: values, y: labels, type: "bar", orientation: "h",
    marker: { color: colors },
  };
  const layout = {
    title, margin: { l: 200, r: 20, t: 40, b: 40 },
    height: Math.max(300, labels.length * 28),
  };
  Plotly.newPlot(containerId, [trace], layout, { responsive: true });
}

function renderGroupedBar(containerId, labels, series, title) {
  const traces = series.map(s => ({
    x: labels, y: s.values, name: s.name, type: "bar",
    marker: { color: s.color },
  }));
  const layout = { title, barmode: "group", margin: { t: 40, b: 60, l: 60, r: 20 } };
  Plotly.newPlot(containerId, traces, layout, { responsive: true });
}

function renderPieChart(containerId, labels, values, title, colors) {
  const trace = {
    labels, values, type: "pie",
    marker: { colors: colors || undefined },
    textinfo: "label+percent",
  };
  const layout = { title, margin: { t: 40, b: 20, l: 20, r: 20 }, height: 350 };
  Plotly.newPlot(containerId, [trace], layout, { responsive: true });
}

function renderGauge(containerId, value, title) {
  const color = value >= 1 ? COLORS.green : value >= 0.9 ? COLORS.orange : COLORS.red;
  const trace = {
    type: "indicator", mode: "gauge+number",
    value: value,
    title: { text: title, font: { size: 13 } },
    gauge: {
      axis: { range: [0, 2] },
      bar: { color },
      steps: [
        { range: [0, 0.8], color: "rgba(255,0,0,0.07)" },
        { range: [0.8, 1.0], color: "rgba(255,165,0,0.07)" },
        { range: [1.0, 2.0], color: "rgba(0,200,0,0.07)" },
      ],
      threshold: { line: { color: "black", width: 2 }, value: 1.0 },
    },
  };
  const layout = { height: 200, margin: { t: 40, b: 0, l: 20, r: 20 } };
  Plotly.newPlot(containerId, [trace], layout, { responsive: true });
}
