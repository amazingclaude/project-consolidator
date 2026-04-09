(async function() {
  const sel = document.getElementById("project-select");
  const metricsEl = document.getElementById("schedule-metrics");
  const portfolioCharts = document.getElementById("portfolio-charts");
  const ganttSection = document.getElementById("gantt-section");
  const milestonesSection = document.getElementById("milestones-section");
  const varianceSection = document.getElementById("variance-section");

  try {
    const projects = await fetchJSON("/api/projects");
    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      sel.appendChild(opt);
    });

    sel.addEventListener("change", () => loadSchedule(sel.value, projects));
    loadSchedule("", projects);
  } catch(e) { showError(metricsEl, e.message); }

  async function loadSchedule(projectId, projects) {
    metricsEl.innerHTML = "";
    if (!projectId) {
      portfolioCharts.style.display = "grid";
      ganttSection.style.display = "none";
      milestonesSection.style.display = "none";
      varianceSection.style.display = "none";
      await loadPortfolio(projects);
    } else {
      portfolioCharts.style.display = "none";
      ganttSection.style.display = "block";
      milestonesSection.style.display = "block";
      varianceSection.style.display = "block";
      await loadProject(projectId);
    }
  }

  async function loadPortfolio(projects) {
    const rows = [];
    for (const p of projects) {
      try {
        const m = await fetchJSON(`/api/projects/${p.id}/schedule-metrics`);
        rows.push({ name: p.name, sv: m.schedule_variance_days || 0, spi: m.spi || 0, slipped: m.slipped_milestones.length, critBehind: m.critical_tasks_behind.length });
      } catch(e) { /* skip */ }
    }
    if (!rows.length) return;

    const sorted = [...rows].sort((a, b) => a.sv - b.sv);
    renderHorizontalBar("sv-chart", sorted.map(r => r.name), sorted.map(r => r.sv), "Schedule Variance by Project (days)", "diverging");

    const bySl = [...rows].sort((a, b) => b.slipped - a.slipped);
    renderHorizontalBar("milestone-chart", bySl.map(r => r.name), bySl.map(r => r.slipped), "Milestone Slippage Count");
  }

  async function loadProject(projectId) {
    const [metrics, tasks] = await Promise.all([
      fetchJSON(`/api/projects/${projectId}/schedule-metrics`),
      fetchJSON(`/api/projects/${projectId}/tasks`),
    ]);

    renderMetricCard(metricsEl, "Schedule Variance", formatDays(metrics.schedule_variance_days));
    renderMetricCard(metricsEl, "SPI", formatIndex(metrics.spi));
    renderMetricCard(metricsEl, "Milestones On Track", `${metrics.milestones_on_track}/${metrics.total_milestones}`);
    renderMetricCard(metricsEl, "Critical Behind", metrics.critical_tasks_behind.length);

    // Gantt
    const ganttTasks = tasks.filter(t => !t.summary).slice(0, 50);
    renderBaselineVsActualGantt("gantt-chart", ganttTasks, "Baseline vs Current");

    // Slipped milestones table
    const msTable = document.getElementById("milestones-table");
    if (metrics.slipped_milestones.length > 0) {
      milestonesSection.style.display = "block";
      renderTable(msTable, [
        { label: "Name", key: "name" },
        { label: "Baseline Finish", render: r => formatDate(r.baseline_finish) },
        { label: "Current Finish", render: r => formatDate(r.current_finish) },
        { label: "Slip (days)", render: r => r.slip_days.toFixed(1) },
      ], metrics.slipped_milestones);
    } else { milestonesSection.style.display = "none"; }

    // Variance chart
    const varData = tasks.filter(t => !t.summary && t.baseline_finish && t.finish).map(t => {
      const bl = new Date(t.baseline_finish), cur = new Date(t.finish);
      return { name: t.name.substring(0, 40), variance: (bl - cur) / 86400000 };
    }).sort((a, b) => a.variance - b.variance);

    if (varData.length > 0) {
      varianceSection.style.display = "block";
      renderHorizontalBar("variance-chart", varData.map(r => r.name), varData.map(r => r.variance), "Task Schedule Variance (positive = ahead)", "diverging");
    }
  }
})();
