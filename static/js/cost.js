(async function() {
  const summaryEl = document.getElementById("cost-summary");
  showLoading(document.getElementById("budget-actual-chart"));

  try {
    const [projects, health] = await Promise.all([
      fetchJSON("/api/projects"),
      fetchJSON("/api/portfolio/health"),
    ]);

    if (!projects.length) {
      showInfo(summaryEl, 'No projects loaded. Go to <a href="/ingestion">Data Ingestion</a>.');
      return;
    }

    // Fetch cost metrics for all projects
    const metrics = await Promise.all(projects.map(p => fetchJSON(`/api/projects/${p.id}/cost-metrics`)));
    const rows = projects.map((p, i) => ({ name: p.name, ...metrics[i] }));

    // Summary
    const totalBudget = rows.reduce((s, r) => s + r.budget_at_completion, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual_cost, 0);
    const totalCV = totalBudget - totalActual;
    const cpis = rows.map(r => r.cpi).filter(v => v != null);
    const avgCpi = cpis.length ? cpis.reduce((s, v) => s + v, 0) / cpis.length : null;

    renderMetricCard(summaryEl, "Total Budget", formatCurrency(totalBudget));
    renderMetricCard(summaryEl, "Total Actual Cost", formatCurrency(totalActual));
    renderMetricCard(summaryEl, "Total Cost Variance", formatCurrency(Math.abs(totalCV)),
      totalCV >= 0 ? "Under budget" : "Over budget", totalCV >= 0);
    renderMetricCard(summaryEl, "Avg CPI", formatIndex(avgCpi));

    // Budget vs Actual grouped bar
    renderGroupedBar("budget-actual-chart", rows.map(r => r.name), [
      { name: "Budget", values: rows.map(r => r.budget_at_completion), color: "#3b82f6" },
      { name: "Actual", values: rows.map(r => r.actual_cost), color: "#dc2626" },
    ], "Budget vs Actual Cost");

    // Cost Variance
    const sorted = [...rows].sort((a, b) => (a.cost_variance || 0) - (b.cost_variance || 0));
    renderHorizontalBar("cv-chart", sorted.map(r => r.name), sorted.map(r => r.cost_variance || 0), "Cost Variance (positive = under budget)", "diverging");

    // CPI gauges
    const gaugesEl = document.getElementById("cpi-gauges");
    const cpiRows = rows.filter(r => r.cpi != null);
    if (cpiRows.length) {
      gaugesEl.style.gridTemplateColumns = `repeat(${Math.min(4, cpiRows.length)}, 1fr)`;
      cpiRows.forEach((r, i) => {
        const div = document.createElement("div");
        div.className = "chart-container";
        div.id = `gauge-${i}`;
        gaugesEl.appendChild(div);
        renderGauge(`gauge-${i}`, r.cpi, r.name.substring(0, 20));
      });
    } else {
      showInfo(gaugesEl, "No CPI data available.");
    }

    // EAC comparison
    const eacRows = rows.filter(r => r.eac != null);
    if (eacRows.length) {
      renderGroupedBar("eac-chart", eacRows.map(r => r.name), [
        { name: "BAC", values: eacRows.map(r => r.budget_at_completion), color: "#3b82f6" },
        { name: "EAC", values: eacRows.map(r => r.eac), color: "#d97706" },
      ], "Budget at Completion vs Estimate at Completion");
    } else {
      showInfo(document.getElementById("eac-chart"), "No EAC data available.");
    }

    // Detailed table
    renderTable(document.getElementById("cost-table"), [
      { label: "Project", key: "name" },
      { label: "Budget", render: r => formatCurrency(r.budget_at_completion) },
      { label: "Actual", render: r => formatCurrency(r.actual_cost) },
      { label: "CV", render: r => formatCurrency(r.cost_variance) },
      { label: "CV%", render: r => formatPct(r.cost_variance_percent) },
      { label: "CPI", render: r => formatIndex(r.cpi) },
      { label: "EAC", render: r => formatCurrency(r.eac) },
      { label: "VAC", render: r => formatCurrency(r.vac) },
    ], rows);
  } catch(e) { showError(summaryEl, e.message); }
})();
