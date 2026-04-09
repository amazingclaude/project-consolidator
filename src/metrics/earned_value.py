"""
Earned Value Management (EVM) computation engine.

Derives CPI, SPI, and the full EVM suite per project from task-level data,
making all projects comparable even when the source files lack project-level
BCWS / BCWP / ACWP fields.

PMI-standard formulas:
    PV  (BCWS) = Σ task.baseline_cost                         (for work-tasks)
    EV  (BCWP) = Σ task.baseline_cost × task.percent_complete  (for work-tasks)
    AC  (ACWP) = Σ task.actual_cost                            (for work-tasks)
    BAC        = PV  (total planned budget)
    CPI        = EV / AC                                       (cost efficiency)
    SPI        = EV / PV                                       (schedule efficiency)
    CV         = EV - AC                                       (cost variance)
    SV         = EV - PV                                       (schedule variance)
    EAC        = BAC / CPI                                     (estimate at completion)
    ETC        = EAC - AC                                      (estimate to complete)
    VAC        = BAC - EAC                                     (variance at completion)
    TCPI       = (BAC - EV) / (BAC - AC)                       (to-complete performance)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from ..database.models import Project, Task


# ---------------------------------------------------------------------------
# Data classes returned by the engine (plain Python — API schemas live in
# src/api/schemas.py and mirror these).
# ---------------------------------------------------------------------------

@dataclass
class ProjectEV:
    """Full earned value metrics for a single project."""

    project_id: int
    project_name: str

    # Core earned value triplet
    pv: float = 0.0          # Planned Value  (BCWS)
    ev: float = 0.0          # Earned Value   (BCWP)
    ac: float = 0.0          # Actual Cost    (ACWP)
    bac: float = 0.0         # Budget at Completion

    # Performance indices
    cpi: Optional[float] = None
    spi: Optional[float] = None

    # Variances
    cv: float = 0.0          # Cost Variance     (EV − AC)
    sv: float = 0.0          # Schedule Variance  (EV − PV)

    # Forecasts
    eac: Optional[float] = None   # Estimate at Completion
    etc: Optional[float] = None   # Estimate to Complete
    vac: Optional[float] = None   # Variance at Completion
    tcpi: Optional[float] = None  # To-Complete Performance Index

    # Derived
    percent_complete: float = 0.0   # Cost-weighted % complete
    health_status: str = "insufficient-data"
    data_quality: str = "insufficient"

    # Counts (useful for transparency)
    task_count: int = 0
    tasks_with_baseline: int = 0
    tasks_with_progress: int = 0


@dataclass
class PortfolioEV:
    """Portfolio-level aggregated earned value."""

    total_pv: float = 0.0
    total_ev: float = 0.0
    total_ac: float = 0.0
    total_bac: float = 0.0

    portfolio_cpi: Optional[float] = None
    portfolio_spi: Optional[float] = None
    portfolio_cv: float = 0.0
    portfolio_sv: float = 0.0

    projects_on_track: int = 0
    projects_watch: int = 0
    projects_at_risk: int = 0
    projects_critical: int = 0
    projects_insufficient_data: int = 0

    projects: list[ProjectEV] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Health status classification
# ---------------------------------------------------------------------------

def _classify_health(cpi: Optional[float], spi: Optional[float]) -> str:
    """Return a health bucket based on CPI/SPI.

    Uses the *worse* of the two indices:
        ≥ 1.0  → on-track
        0.9–1.0 → watch
        0.8–0.9 → at-risk
        < 0.8   → critical
    If both are None → insufficient-data.
    """
    values = [v for v in (cpi, spi) if v is not None]
    if not values:
        return "insufficient-data"
    worst = min(values)
    if worst >= 1.0:
        return "on-track"
    if worst >= 0.9:
        return "watch"
    if worst >= 0.8:
        return "at-risk"
    return "critical"


def _classify_data_quality(
    task_count: int, tasks_with_baseline: int, tasks_with_progress: int
) -> str:
    """Assess how trustworthy the EV numbers are.

    full     — ≥ 80% of tasks have both baseline & progress data
    partial  — ≥ 30% of tasks have at least baseline data
    insufficient — less than 30% baseline coverage
    """
    if task_count == 0:
        return "insufficient"
    baseline_pct = tasks_with_baseline / task_count
    progress_pct = tasks_with_progress / task_count
    if baseline_pct >= 0.8 and progress_pct >= 0.5:
        return "full"
    if baseline_pct >= 0.3:
        return "partial"
    return "insufficient"


# ---------------------------------------------------------------------------
# Per-project computation
# ---------------------------------------------------------------------------

def _safe_div(numerator: float, denominator: float) -> Optional[float]:
    """Divide, returning None when the denominator is zero or very close."""
    if denominator is None or abs(denominator) < 1e-9:
        return None
    return numerator / denominator


def compute_project_ev(project: Project, tasks: list[Task]) -> ProjectEV:
    """Compute earned value metrics for a single project.

    Strategy:
    1. If the *project* model already carries non-zero BCWS/BCWP/ACWP
       (i.e. the source file had EV data), use those directly.
    2. Otherwise, aggregate from task-level baseline_cost, actual_cost,
       and percent_complete using standard PMI formulas.
    """

    result = ProjectEV(project_id=project.id, project_name=project.name)

    # ----- filter to work tasks (non-summary, non-null, non-milestone) ------
    work_tasks = [
        t for t in tasks
        if not t.summary and not t.is_null
    ]
    result.task_count = len(work_tasks)

    # ----- decide source: project-level vs task aggregation -----------------
    has_project_ev = (
        project.bcws is not None and project.bcws > 0
        and project.bcwp is not None and project.bcwp > 0
    )

    if has_project_ev:
        # Use project-level EV data from the source file
        pv = float(project.bcws)
        ev = float(project.bcwp)
        ac = float(project.acwp) if project.acwp else 0.0
        result.tasks_with_baseline = len(work_tasks)
        result.tasks_with_progress = len(work_tasks)
    else:
        # Aggregate from task-level data
        pv = 0.0
        ev = 0.0
        ac = 0.0
        baseline_count = 0
        progress_count = 0

        for t in work_tasks:
            bc = t.baseline_cost or 0.0
            pct = t.percent_complete or 0.0
            act = t.actual_cost or 0.0

            if bc > 0:
                baseline_count += 1
                pv += bc
                ev += bc * (pct / 100.0)

            if pct > 0:
                progress_count += 1

            ac += act

        result.tasks_with_baseline = baseline_count
        result.tasks_with_progress = progress_count

    # ----- core triplet -----------------------------------------------------
    result.pv = round(pv, 2)
    result.ev = round(ev, 2)
    result.ac = round(ac, 2)
    result.bac = round(pv, 2)  # BAC = total planned value

    # ----- performance indices -----------------------------------------------
    result.cpi = _safe_div(ev, ac)
    result.spi = _safe_div(ev, pv)

    # Round indices for readability
    if result.cpi is not None:
        result.cpi = round(result.cpi, 4)
    if result.spi is not None:
        result.spi = round(result.spi, 4)

    # ----- variances ---------------------------------------------------------
    result.cv = round(ev - ac, 2)
    result.sv = round(ev - pv, 2)

    # ----- forecasts ---------------------------------------------------------
    if result.cpi is not None and result.cpi > 0:
        eac = pv / result.cpi
        result.eac = round(eac, 2)
        result.etc = round(eac - ac, 2)
        result.vac = round(pv - eac, 2)

    # TCPI: to-complete performance index
    bac_minus_ac = pv - ac
    if bac_minus_ac > 1e-9:
        result.tcpi = round((pv - ev) / bac_minus_ac, 4)

    # ----- percent complete (cost-weighted) ----------------------------------
    if pv > 0:
        result.percent_complete = round((ev / pv) * 100, 2)

    # ----- health & data quality ---------------------------------------------
    result.data_quality = _classify_data_quality(
        result.task_count, result.tasks_with_baseline, result.tasks_with_progress,
    )
    result.health_status = _classify_health(result.cpi, result.spi)

    return result


# ---------------------------------------------------------------------------
# Portfolio-level aggregation
# ---------------------------------------------------------------------------

def compute_portfolio_ev(
    projects_with_tasks: list[tuple[Project, list[Task]]],
) -> PortfolioEV:
    """Compute portfolio-level EV by aggregating per-project results.

    Parameters
    ----------
    projects_with_tasks : list of (project, tasks) tuples
    """
    portfolio = PortfolioEV()

    for project, tasks in projects_with_tasks:
        pev = compute_project_ev(project, tasks)
        portfolio.projects.append(pev)

        portfolio.total_pv += pev.pv
        portfolio.total_ev += pev.ev
        portfolio.total_ac += pev.ac
        portfolio.total_bac += pev.bac

        # Tally health buckets
        if pev.health_status == "on-track":
            portfolio.projects_on_track += 1
        elif pev.health_status == "watch":
            portfolio.projects_watch += 1
        elif pev.health_status == "at-risk":
            portfolio.projects_at_risk += 1
        elif pev.health_status == "critical":
            portfolio.projects_critical += 1
        else:
            portfolio.projects_insufficient_data += 1

    # Round aggregates
    portfolio.total_pv = round(portfolio.total_pv, 2)
    portfolio.total_ev = round(portfolio.total_ev, 2)
    portfolio.total_ac = round(portfolio.total_ac, 2)
    portfolio.total_bac = round(portfolio.total_bac, 2)

    # Portfolio-level indices
    portfolio.portfolio_cpi = _safe_div(portfolio.total_ev, portfolio.total_ac)
    portfolio.portfolio_spi = _safe_div(portfolio.total_ev, portfolio.total_pv)
    if portfolio.portfolio_cpi is not None:
        portfolio.portfolio_cpi = round(portfolio.portfolio_cpi, 4)
    if portfolio.portfolio_spi is not None:
        portfolio.portfolio_spi = round(portfolio.portfolio_spi, 4)

    portfolio.portfolio_cv = round(portfolio.total_ev - portfolio.total_ac, 2)
    portfolio.portfolio_sv = round(portfolio.total_ev - portfolio.total_pv, 2)

    # Sort projects by CPI ascending (worst first) for comparison
    portfolio.projects.sort(
        key=lambda p: (p.cpi if p.cpi is not None else 999),
    )

    return portfolio
