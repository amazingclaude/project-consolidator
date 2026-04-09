(async function() {
  const summaryEl = document.getElementById("summary-cards");
  const costEl = document.getElementById("cost-cards");
  const scatterEl = document.getElementById("scatter-chart");
  const tableEl = document.getElementById("health-table");

  showLoading(scatterEl);

  try {
    const [summary, health] = await Promise.all([
      fetchJSON("/api/portfolio/summary"),
      fetchJSON("/api/portfolio/health"),
    ]);

    // Summary cards
    renderMetricCard(summaryEl, "Projects", summary.total_projects);
    renderMetricCard(summaryEl, "Total Tasks", summary.total_tasks.toLocaleString());
    renderMetricCard(summaryEl, "Deviations", summary.total_deviations);
    renderMetricCard(summaryEl, "Critical Issues", summary.critical_deviations);

    // Cost cards
    const cv = summary.total_baseline_cost - summary.total_actual_cost;
    renderMetricCard(costEl, "Total Budget", formatCurrency(summary.total_baseline_cost));
    renderMetricCard(costEl, "Total Actual", formatCurrency(summary.total_actual_cost));
    renderMetricCard(costEl, "Cost Variance", formatCurrency(Math.abs(cv)),
      cv >= 0 ? "Under budget" : "Over budget", cv >= 0);

    if (summary.total_projects === 0) {
      showInfo(scatterEl, 'No projects loaded yet. Go to <a href="/ingestion">Data Ingestion</a> to load project files.');
      tableEl.innerHTML = "";
      return;
    }

    // CPI/SPI scatter
    const evData = health.filter(h => h.cpi != null && h.spi != null);
    if (evData.length > 0) {
      renderCpiSpiScatter("scatter-chart", evData);
    } else {
      showInfo(scatterEl, "No projects with Earned Value data available for CPI/SPI scatter.");
    }

    // Health table
    renderTable(tableEl, [
      { label: "Project", key: "name" },
      { label: "Tasks", key: "tasks" },
      { label: "Budget", render: r => formatCurrency(r.budget) },
      { label: "Actual Cost", render: r => formatCurrency(r.actual_cost) },
      { label: "CPI", render: r => formatIndex(r.cpi) },
      { label: "SPI", render: r => formatIndex(r.spi) },
      { label: "Critical Issues", key: "critical_issues" },
      { label: "", render: r => `<a href="/project/${r.id}" style="color:#3b82f6">Detail &rarr;</a>` },
    ], health);
  } catch (e) {
    showError(summaryEl, e.message);
  }
})();
