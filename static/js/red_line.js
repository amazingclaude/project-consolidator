(async function() {
  const cardsEl = document.getElementById("deviation-cards");
  const tableEl = document.getElementById("deviation-table");
  const projectSel = document.getElementById("filter-project");
  const severitySel = document.getElementById("filter-severity");
  const typeSel = document.getElementById("filter-type");

  // Populate project filter
  try {
    const projects = await fetchJSON("/api/projects");
    projects.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.name;
      projectSel.appendChild(opt);
    });
  } catch(e) {}

  async function loadDeviations() {
    cardsEl.innerHTML = "";
    const params = new URLSearchParams();
    if (severitySel.value) params.set("severity", severitySel.value);
    if (projectSel.value) params.set("project_id", projectSel.value);
    if (typeSel.value) params.set("type", typeSel.value);

    try {
      const devs = await fetchJSON(`/api/deviations?${params}`);

      const critical = devs.filter(d => d.severity === "critical").length;
      const warning = devs.filter(d => d.severity === "warning").length;
      renderMetricCard(cardsEl, "Total Deviations", devs.length);
      renderMetricCard(cardsEl, "Critical", critical);
      renderMetricCard(cardsEl, "Warnings", warning);

      if (!devs.length) {
        showInfo(document.getElementById("type-pie"), "No deviations found.");
        document.getElementById("severity-pie").innerHTML = "";
        document.getElementById("project-bar").innerHTML = "";
        tableEl.innerHTML = '<div class="alert alert-success">No deviations found matching the current filters.</div>';
        return;
      }

      // By type pie
      const typeCounts = {};
      const projCounts = {};
      devs.forEach(d => {
        const t = d.deviation_type.replace(/_/g, " ");
        typeCounts[t] = (typeCounts[t] || 0) + 1;
        projCounts[d.project_name] = (projCounts[d.project_name] || 0) + 1;
      });
      renderPieChart("type-pie", Object.keys(typeCounts), Object.values(typeCounts), "Deviations by Type");
      renderPieChart("severity-pie", ["Critical", "Warning"], [critical, warning], "Deviations by Severity", ["#dc2626", "#d97706"]);

      // By project bar
      const sortedProj = Object.entries(projCounts).sort((a, b) => b[1] - a[1]);
      renderHorizontalBar("project-bar", sortedProj.map(r => r[0]), sortedProj.map(r => r[1]), "Deviations by Project");

      // Table
      renderTable(tableEl, [
        { label: "Severity", render: r => severityBadge(r.severity) },
        { label: "Project", key: "project_name" },
        { label: "Type", render: r => r.deviation_type.replace(/_/g, " ") },
        { label: "Metric", key: "metric_name" },
        { label: "Baseline", render: r => r.baseline_value || "-" },
        { label: "Actual", render: r => r.actual_value || "-" },
        { label: "Variance", render: r => r.variance != null ? r.variance.toFixed(1) : "-" },
        { label: "Description", key: "description" },
      ], devs);
    } catch(e) { showError(cardsEl, e.message); }
  }

  severitySel.addEventListener("change", loadDeviations);
  projectSel.addEventListener("change", loadDeviations);
  typeSel.addEventListener("change", loadDeviations);
  loadDeviations();
})();
