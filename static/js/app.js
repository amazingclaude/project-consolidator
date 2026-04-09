// === Shared utilities ===

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function formatCurrency(val) {
  if (val == null) return "N/A";
  return "$" + Math.round(val).toLocaleString();
}

function formatIndex(val) {
  if (val == null) return "N/A";
  return val.toFixed(3);
}

function formatPct(val) {
  if (val == null) return "N/A";
  return val.toFixed(1) + "%";
}

function formatDays(val) {
  if (val == null) return "N/A";
  return val.toFixed(1) + " days";
}

function formatHours(val) {
  if (val == null) return "N/A";
  return Math.round(val).toLocaleString() + " hrs";
}

function formatDate(val) {
  if (!val) return "N/A";
  return new Date(val).toLocaleDateString();
}

function renderMetricCard(container, label, value, delta, deltaPositive) {
  const card = document.createElement("div");
  card.className = "metric-card";
  let html = `<div class="label">${label}</div><div class="value">${value}</div>`;
  if (delta !== undefined && delta !== null) {
    const cls = deltaPositive ? "delta-positive" : "delta-negative";
    html += `<div class="delta ${cls}">${delta}</div>`;
  }
  card.innerHTML = html;
  container.appendChild(card);
}

function renderTable(container, columns, rows) {
  let html = "<table><thead><tr>";
  columns.forEach(c => { html += `<th>${c.label}</th>`; });
  html += "</tr></thead><tbody>";
  rows.forEach(row => {
    html += "<tr>";
    columns.forEach(c => {
      let val = c.render ? c.render(row) : (row[c.key] ?? "");
      html += `<td>${val}</td>`;
    });
    html += "</tr>";
  });
  html += "</tbody></table>";
  container.innerHTML = html;
}

function showLoading(el) {
  el.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
}

function showError(el, msg) {
  el.innerHTML = `<div class="alert alert-error">${msg}</div>`;
}

function showInfo(el, msg) {
  el.innerHTML = `<div class="alert alert-info">${msg}</div>`;
}

function severityBadge(severity) {
  const cls = severity === "critical" ? "badge-critical" : "badge-warning";
  return `<span class="badge ${cls}">${severity.toUpperCase()}</span>`;
}

function healthDot(score) {
  const cls = score >= 0.9 ? "health-green" : score >= 0.7 ? "health-orange" : "health-red";
  const label = score >= 0.9 ? "Healthy" : score >= 0.7 ? "At Risk" : "Critical";
  return `<span class="health-dot ${cls}"></span> ${label} (${(score * 100).toFixed(0)}%)`;
}

// Tab switching
function initTabs(container) {
  const buttons = container.querySelectorAll(".tab-btn");
  const contents = container.querySelectorAll(".tab-content");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}
