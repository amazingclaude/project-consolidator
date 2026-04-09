// === Ingestion Page ===

const directories = [];

document.addEventListener("DOMContentLoaded", () => {
  loadDbStats();

  document.getElementById("add-dir-btn").addEventListener("click", addDirectory);
  document.getElementById("dir-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addDirectory();
  });
  document.getElementById("run-btn").addEventListener("click", runIngestion);
});

function addDirectory() {
  const input = document.getElementById("dir-input");
  const path = input.value.trim();
  if (!path) return;
  if (directories.includes(path)) {
    input.value = "";
    return;
  }
  directories.push(path);
  input.value = "";
  renderDirList();
}

function removeDirectory(index) {
  directories.splice(index, 1);
  renderDirList();
}

function renderDirList() {
  const container = document.getElementById("dir-list");
  if (directories.length === 0) {
    container.innerHTML = '<p style="color:#94a3b8;font-size:0.9rem">No directories added yet.</p>';
    return;
  }
  container.innerHTML = directories
    .map(
      (dir, i) => `
    <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;
                padding:0.4rem 0.6rem;background:#f1f5f9;border-radius:6px;">
      <code style="flex:1;font-size:0.85rem">${escapeHtml(dir)}</code>
      <button class="btn" style="padding:2px 8px;font-size:0.8rem;min-width:auto"
              onclick="removeDirectory(${i})">✕</button>
    </div>`
    )
    .join("");
}

async function runIngestion() {
  if (directories.length === 0) {
    showError("result-area", "Add at least one directory before running ingestion.");
    return;
  }

  const useCache = document.getElementById("use-cache").checked;
  const batchSize = parseInt(document.getElementById("batch-size").value, 10) || 20;
  const runBtn = document.getElementById("run-btn");
  const progressArea = document.getElementById("progress-area");
  const progressFill = document.getElementById("progress-fill");
  const progressText = document.getElementById("progress-text");
  const resultArea = document.getElementById("result-area");

  // Reset UI
  runBtn.disabled = true;
  runBtn.textContent = "Running…";
  progressArea.style.display = "block";
  progressFill.style.width = "0%";
  progressText.textContent = "Starting ingestion…";
  resultArea.innerHTML = "";

  // Animate indeterminate progress
  let pct = 0;
  const ticker = setInterval(() => {
    pct = Math.min(pct + 2, 90);
    progressFill.style.width = pct + "%";
  }, 300);

  try {
    const data = await postJSON("/api/ingestion/run", {
      directories: directories,
      use_cache: useCache,
      batch_size: batchSize,
    });

    clearInterval(ticker);
    progressFill.style.width = "100%";
    progressText.textContent = "Complete!";

    // Render results
    const total = data.files_discovered || 0;
    const parsed = data.files_parsed || 0;
    const skipped = data.files_skipped || 0;
    const errored = data.files_errored || 0;

    let html = `
      <div class="metrics-grid cols-4" style="margin-bottom:1rem">
        ${metricCardHtml("Files Discovered", total)}
        ${metricCardHtml("Files Parsed", parsed, parsed > 0 ? "success" : null)}
        ${metricCardHtml("Files Skipped", skipped)}
        ${metricCardHtml("Files Errored", errored, errored > 0 ? "danger" : null)}
      </div>`;

    if (data.errors && data.errors.length > 0) {
      html += `<div class="alert alert-danger"><strong>Errors:</strong><ul style="margin:0.5rem 0 0 1.2rem">`;
      data.errors.forEach((err) => {
        html += `<li>${escapeHtml(err)}</li>`;
      });
      html += `</ul></div>`;
    } else if (parsed > 0) {
      html += `<div class="alert alert-success">Ingestion completed successfully — ${parsed} file(s) processed.</div>`;
    } else if (skipped === total && total > 0) {
      html += `<div class="alert alert-info">All files unchanged (skipped via cache).</div>`;
    }

    resultArea.innerHTML = html;

    // Refresh DB stats
    loadDbStats();
  } catch (err) {
    clearInterval(ticker);
    progressFill.style.width = "0%";
    progressText.textContent = "Failed";
    showError("result-area", `Ingestion failed: ${err.message}`);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run Ingestion";
  }
}

async function loadDbStats() {
  const container = document.getElementById("db-stats");
  try {
    const data = await fetchJSON("/api/ingestion/status");
    container.innerHTML = `
      ${metricCardHtml("Projects", data.total_projects)}
      ${metricCardHtml("Tasks", data.total_tasks)}
      ${metricCardHtml("Deviations", data.total_deviations)}
    `;
  } catch {
    container.innerHTML = '<p style="color:#94a3b8">No data loaded yet.</p>';
  }
}

function metricCardHtml(label, value, variant) {
  const colorMap = { success: "#16a34a", danger: "#dc2626" };
  const color = variant ? colorMap[variant] : "#1e293b";
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value" style="color:${color}">${value}</div>
    </div>`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
