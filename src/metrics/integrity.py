from ..database.models import Project, Task, Resource, Assignment


def calculate_integrity_metrics(
    project: Project,
    tasks: list[Task],
    resources: list[Resource],
    assignments: list[Assignment],
) -> dict:
    non_summary = [t for t in tasks if not t.summary and not t.is_null]
    total = len(non_summary) if non_summary else 1

    has_baseline = sum(
        1 for t in non_summary
        if t.baseline_start is not None and t.baseline_finish is not None
    )
    baseline_coverage = has_baseline / total

    has_cost = sum(1 for t in non_summary if t.cost is not None and t.cost > 0)
    cost_completeness = has_cost / total

    has_resource = sum(
        1 for t in non_summary
        if t.resource_names is not None and t.resource_names.strip()
    )
    resource_coverage = has_resource / total

    started = [t for t in non_summary if t.actual_start is not None]
    has_progress = sum(1 for t in started if t.percent_complete is not None)
    progress_tracking = has_progress / len(started) if started else 1.0

    orphaned = []
    for t in non_summary:
        if (t.outline_level and t.outline_level > 1
                and not t.predecessor_uids and not t.parent_task_uid):
            orphaned.append({"task_uid": t.task_uid, "name": t.name})

    missing_resources = sum(1 for a in assignments if a.resource_uid == 0)

    score = (
        baseline_coverage * 0.3
        + cost_completeness * 0.2
        + resource_coverage * 0.2
        + progress_tracking * 0.3
    )

    return {
        "overall_score": round(score, 3),
        "baseline_coverage": round(baseline_coverage, 3),
        "cost_completeness": round(cost_completeness, 3),
        "resource_coverage": round(resource_coverage, 3),
        "progress_tracking": round(progress_tracking, 3),
        "orphaned_tasks": orphaned,
        "missing_resource_assignments": missing_resources,
        "total_tasks": len(non_summary),
        "total_resources": len(resources),
        "total_assignments": len(assignments),
    }
