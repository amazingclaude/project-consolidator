from datetime import datetime
from ..database.models import Project, Task
from .earned_value import compute_project_ev


def schedule_variance_days(baseline_finish: datetime, current_finish: datetime) -> float | None:
    if baseline_finish is None or current_finish is None:
        return None
    delta = baseline_finish - current_finish
    return delta.total_seconds() / 86400


def schedule_performance_index(bcwp: float, bcws: float) -> float | None:
    if bcwp is None or bcws is None or bcws == 0:
        return None
    return bcwp / bcws


def start_variance_days(baseline_start: datetime, actual_start: datetime) -> float | None:
    if baseline_start is None or actual_start is None:
        return None
    delta = baseline_start - actual_start
    return delta.total_seconds() / 86400


def finish_variance_days(baseline_finish: datetime, current_finish: datetime) -> float | None:
    return schedule_variance_days(baseline_finish, current_finish)


def calculate_project_schedule_metrics(project: Project, tasks: list[Task]) -> dict:
    spi = schedule_performance_index(project.bcwp, project.bcws)
    sv = schedule_variance_days(project.baseline_finish, project.finish)

    # --- EV engine fallback: derive SPI from task data when project-level EV is missing ---
    bcwp_out = project.bcwp
    bcws_out = project.bcws
    if spi is None and tasks:
        pev = compute_project_ev(project, tasks)
        if pev.spi is not None:
            spi = pev.spi
            bcwp_out = pev.ev
            bcws_out = pev.pv

    milestones = [t for t in tasks if t.milestone]
    slipped_milestones = []
    for m in milestones:
        slip = finish_variance_days(m.baseline_finish, m.finish)
        if slip is not None and slip < -1:
            slipped_milestones.append({
                "task_uid": m.task_uid,
                "name": m.name,
                "baseline_finish": m.baseline_finish,
                "current_finish": m.finish,
                "slip_days": abs(slip),
            })

    critical_behind = []
    for t in tasks:
        if t.critical and t.baseline_finish and t.finish:
            slip = finish_variance_days(t.baseline_finish, t.finish)
            if slip is not None and slip < -1:
                critical_behind.append({
                    "task_uid": t.task_uid,
                    "name": t.name,
                    "slip_days": abs(slip),
                })

    return {
        "spi": spi,
        "schedule_variance_days": sv,
        "bcwp": bcwp_out,
        "bcws": bcws_out,
        "slipped_milestones": slipped_milestones,
        "critical_tasks_behind": critical_behind,
        "total_milestones": len(milestones),
        "milestones_on_track": len(milestones) - len(slipped_milestones),
    }
