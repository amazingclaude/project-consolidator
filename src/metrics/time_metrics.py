from ..database.models import Task


def duration_variance_hours(baseline_hours: float, actual_hours: float) -> float | None:
    if baseline_hours is None or actual_hours is None:
        return None
    return baseline_hours - actual_hours


def duration_variance_percent(baseline_hours: float, actual_hours: float) -> float | None:
    if baseline_hours is None or actual_hours is None or baseline_hours == 0:
        return None
    return ((baseline_hours - actual_hours) / baseline_hours) * 100


def calculate_time_metrics(tasks: list[Task]) -> dict:
    non_summary = [t for t in tasks if not t.summary and not t.is_null]

    total_planned = sum(t.baseline_duration_hours or 0 for t in non_summary)
    total_actual = sum(t.actual_duration_hours or 0 for t in non_summary)
    total_remaining = sum(t.remaining_duration_hours or 0 for t in non_summary)

    overrun_tasks = []
    for t in non_summary:
        dv = duration_variance_hours(t.baseline_duration_hours, t.actual_duration_hours)
        if dv is not None and dv < 0:
            overrun_tasks.append({
                "task_uid": t.task_uid,
                "name": t.name,
                "baseline_hours": t.baseline_duration_hours,
                "actual_hours": t.actual_duration_hours,
                "overrun_hours": abs(dv),
            })

    critical_path_length = sum(
        t.duration_hours or 0 for t in non_summary if t.critical
    )

    return {
        "total_planned_hours": total_planned,
        "total_actual_hours": total_actual,
        "total_remaining_hours": total_remaining,
        "duration_variance_hours": total_planned - total_actual,
        "tasks_with_overrun": overrun_tasks,
        "critical_path_length_hours": critical_path_length,
    }
