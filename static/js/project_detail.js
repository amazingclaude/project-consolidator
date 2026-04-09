(async function() {
  const sel = document.getElementById("project-select");
  const infoEl = document.getElementById("project-info");

  // Get project_id from template context (embedded by Jinja2 if navigated via /project/N)
  const urlMatch = window.location.pathname.match(/\/project\/(\d+)/);
  let initialProjectId = urlMatch ? urlMatch[1] : null;

  try {
    const projects = await fetchJSON("/api/projects");
    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      sel.appendChild(opt);
    });

    if (initialProjectId) {
      sel.value = initialProjectId;
      loadProject(initialProjectId);
    }

    sel.addEventListener("change", () => {
      if (sel.value) loadProject(sel.value);
      else infoEl.style.display = "none";
    });
  } catch(e) { showError(document.querySelector(".page-header"), e.message); }

  async function loadProject(id) {
    infoEl.style.display = "block";
    initTabs(document.getElementById("detail-tabs").parentElement);

    const [detail, costM, schedM, timeM, intM, tasks, devs] = await Promise.all([
      fetchJSON(`/api/projects/${id}`),
      fetchJSON(`/api/projects/${id}/cost-metrics`),
      fetchJSON(`/api/projects/${id}/schedule-metrics`),
      fetchJSON(`/api/projects/${id}/time-metrics`),
      fetchJSON(`/api/projects/${id}/integrity-metrics`),
      fetchJSON(`/api/projects/${id}/tasks`),
      fetchJSON(`/api/projects/${id}/deviations`),
    ]);

    // Meta info
    const metaEl = document.getElementById("project-meta");
    metaEl.innerHTML = "";
    renderMetricCard(metaEl, "File", `<span style="font-size:0.7rem;word-break:break-all">${detail.file_path}</span>`);
    renderMetricCard(metaEl, "Tasks / Deviations", `${detail.task_count} / ${detail.deviation_count}`);
    renderMetricCard(metaEl, "Dates", `${formatDate(detail.start)} &mdash; ${formatDate(detail.finish)}`);

    // Cost tab
    const costEl = document.getElementById("cost-metrics");
    costEl.innerHTML = "";
    const cv = costM.cost_variance;
    renderMetricCard(costEl, "Budget (BAC)", formatCurrency(costM.budget_at_completion));
    renderMetricCard(costEl, "Actual Cost", formatCurrency(costM.actual_cost));
    renderMetricCard(costEl, "Cost Variance", formatCurrency(cv != null ? Math.abs(cv) : null),
      cv != null ? (cv >= 0 ? "Under budget" : "Over budget") : null, cv != null && cv >= 0);
    renderMetricCard(costEl, "CPI", formatIndex(costM.cpi));

    const costExtraEl = document.getElementById("cost-extra");
    costExtraEl.innerHTML = "";
    renderMetricCard(costExtraEl, "EAC", formatCurrency(costM.eac));
    renderMetricCard(costExtraEl, "VAC", formatCurrency(costM.vac));

    // Top tasks by cost
    const costTasks = tasks.filter(t => !t.summary && (t.cost || 0) > 0).sort((a, b) => (b.cost || 0) - (a.cost || 0)).slice(0, 20);
    renderTable(document.getElementById("cost-tasks-table"), [
      { label: "Name", key: "name" },
      { label: "Budget", render: r => formatCurrency(r.baseline_cost) },
      { label: "Actual", render: r => formatCurrency(r.actual_cost) },
      { label: "Cost", render: r => formatCurrency(r.cost) },
    ], costTasks);

    // Schedule tab
    const schedEl = document.getElementById("sched-metrics");
    schedEl.innerHTML = "";
    renderMetricCard(schedEl, "SV (days)", formatDays(schedM.schedule_variance_days));
    renderMetricCard(schedEl, "SPI", formatIndex(schedM.spi));
    renderMetricCard(schedEl, "Milestones On Track", `${schedM.milestones_on_track}/${schedM.total_milestones}`);
    renderMetricCard(schedEl, "Critical Behind", schedM.critical_tasks_behind.length);

    const msTable = document.getElementById("sched-milestones");
    if (schedM.slipped_milestones.length) {
      renderTable(msTable, [
        { label: "Name", key: "name" },
        { label: "Baseline Finish", render: r => formatDate(r.baseline_finish) },
        { label: "Current Finish", render: r => formatDate(r.current_finish) },
        { label: "Slip (days)", render: r => r.slip_days.toFixed(1) },
      ], schedM.slipped_milestones);
    } else { showInfo(msTable, "No slipped milestones."); }

    // Time tab
    const timeEl = document.getElementById("time-metrics");
    timeEl.innerHTML = "";
    renderMetricCard(timeEl, "Planned Hours", formatHours(timeM.total_planned_hours));
    renderMetricCard(timeEl, "Actual Hours", formatHours(timeM.total_actual_hours));
    renderMetricCard(timeEl, "Remaining Hours", formatHours(timeM.total_remaining_hours));

    const timeExtraEl = document.getElementById("time-extra");
    timeExtraEl.innerHTML = "";
    renderMetricCard(timeExtraEl, "Duration Variance", formatHours(timeM.duration_variance_hours));
    renderMetricCard(timeExtraEl, "Critical Path Length", formatHours(timeM.critical_path_length_hours));

    const overrunTable = document.getElementById("time-overrun");
    if (timeM.tasks_with_overrun.length) {
      renderTable(overrunTable, [
        { label: "Name", key: "name" },
        { label: "Baseline", render: r => formatHours(r.baseline_hours) },
        { label: "Actual", render: r => formatHours(r.actual_hours) },
        { label: "Overrun", render: r => formatHours(r.overrun_hours) },
      ], timeM.tasks_with_overrun.slice(0, 20));
    } else { showInfo(overrunTable, "No tasks with duration overrun."); }

    // Integrity tab
    const intIndEl = document.getElementById("integrity-indicators");
    intIndEl.innerHTML = [
      `<div class="health-bar">${healthDot(intM.overall_score)} <span class="health-label">Overall Integrity</span></div>`,
      `<div class="health-bar">${healthDot(intM.baseline_coverage)} <span class="health-label">Baseline Coverage</span></div>`,
      `<div class="health-bar">${healthDot(intM.cost_completeness)} <span class="health-label">Cost Completeness</span></div>`,
      `<div class="health-bar">${healthDot(intM.resource_coverage)} <span class="health-label">Resource Coverage</span></div>`,
      `<div class="health-bar">${healthDot(intM.progress_tracking)} <span class="health-label">Progress Tracking</span></div>`,
    ].join("");

    const intStatsEl = document.getElementById("integrity-stats");
    intStatsEl.innerHTML = "";
    renderMetricCard(intStatsEl, "Total Tasks", intM.total_tasks);
    renderMetricCard(intStatsEl, "Resources", intM.total_resources);
    renderMetricCard(intStatsEl, "Missing Assignments", intM.missing_resource_assignments);

    const orphTable = document.getElementById("integrity-orphaned");
    if (intM.orphaned_tasks.length) {
      renderTable(orphTable, [
        { label: "Task UID", key: "task_uid" },
        { label: "Name", key: "name" },
      ], intM.orphaned_tasks);
    } else { showInfo(orphTable, "No orphaned tasks detected."); }

    // Gantt tab
    const ganttTasks = tasks.filter(t => !t.summary && t.start && t.finish).slice(0, 60);
    renderBaselineVsActualGantt("gantt-chart", ganttTasks, `${detail.name} - Baseline vs Current`);

    // Deviations tab
    const devTable = document.getElementById("dev-table");
    if (devs.length) {
      renderTable(devTable, [
        { label: "Severity", render: r => severityBadge(r.severity) },
        { label: "Type", render: r => r.deviation_type.replace(/_/g, " ") },
        { label: "Metric", key: "metric_name" },
        { label: "Baseline", render: r => r.baseline_value || "-" },
        { label: "Actual", render: r => r.actual_value || "-" },
        { label: "Variance", render: r => r.variance != null ? r.variance.toFixed(1) : "-" },
        { label: "Description", key: "description" },
      ], devs);
    } else { showInfo(devTable, "No deviations detected for this project."); }
  }
})();
