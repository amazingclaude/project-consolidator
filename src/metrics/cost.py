from ..database.models import Project, Task
from .earned_value import compute_project_ev


def cost_variance(baseline_cost: float, actual_cost: float) -> float | None:
    if baseline_cost is None or actual_cost is None:
        return None
    return baseline_cost - actual_cost


def cost_performance_index(bcwp: float, acwp: float) -> float | None:
    if bcwp is None or acwp is None or acwp == 0:
        return None
    return bcwp / acwp


def estimate_at_completion(bac: float, cpi: float) -> float | None:
    if bac is None or cpi is None or cpi == 0:
        return None
    return bac / cpi


def variance_at_completion(bac: float, eac: float) -> float | None:
    if bac is None or eac is None:
        return None
    return bac - eac


def calculate_project_cost_metrics(project: Project, tasks: list[Task] | None = None) -> dict:
    bac = project.baseline_cost or 0
    bcwp = project.bcwp
    acwp = project.acwp
    actual = project.actual_cost or 0

    cpi = cost_performance_index(bcwp, acwp)

    # --- EV engine fallback: derive CPI from task data when project-level EV is missing ---
    if cpi is None and tasks is not None:
        pev = compute_project_ev(project, tasks)
        if pev.cpi is not None:
            cpi = pev.cpi
            bcwp = pev.ev
            acwp = pev.ac
            if pev.bac > 0:
                bac = pev.bac
    elif cpi is None and tasks is None:
        # Try using the project's own tasks relationship
        try:
            task_list = list(project.tasks)
            if task_list:
                pev = compute_project_ev(project, task_list)
                if pev.cpi is not None:
                    cpi = pev.cpi
                    bcwp = pev.ev
                    acwp = pev.ac
                    if pev.bac > 0:
                        bac = pev.bac
        except Exception:
            pass

    eac = estimate_at_completion(bac, cpi) if cpi else None
    vac = variance_at_completion(bac, eac) if eac else None

    return {
        "budget_at_completion": bac,
        "actual_cost": actual,
        "cost_variance": cost_variance(bac, actual),
        "cost_variance_percent": ((bac - actual) / bac * 100) if bac else None,
        "bcwp": bcwp,
        "acwp": acwp,
        "cpi": cpi,
        "eac": eac,
        "vac": vac,
    }
