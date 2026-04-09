from datetime import datetime
from ..parsers.base_parser import ParsedProject
from ..database.models import Project, Task, Resource, Assignment


def normalize_to_models(
    parsed: ParsedProject,
    file_path: str,
    file_format: str,
    source_directory: str,
    file_hash: str,
    file_modified: datetime,
) -> Project:
    project = Project(
        name=parsed.name or file_path.rsplit("/", 1)[-1],
        file_path=file_path,
        file_format=file_format,
        source_directory=source_directory,
        file_hash=file_hash,
        file_modified=file_modified,
        ingested_at=datetime.utcnow(),
        start=parsed.start,
        finish=parsed.finish,
        baseline_start=parsed.baseline_start,
        baseline_finish=parsed.baseline_finish,
        actual_start=parsed.actual_start,
        actual_finish=parsed.actual_finish,
        status_date=parsed.status_date,
        cost=parsed.cost,
        baseline_cost=parsed.baseline_cost,
        actual_cost=parsed.actual_cost,
        bcws=parsed.bcws,
        bcwp=parsed.bcwp,
        acwp=parsed.acwp,
    )

    for pt in parsed.tasks:
        project.tasks.append(Task(
            task_uid=pt.uid, task_id=pt.task_id, name=pt.name, wbs=pt.wbs,
            outline_level=pt.outline_level, parent_task_uid=pt.parent_task_uid,
            start=pt.start, finish=pt.finish,
            baseline_start=pt.baseline_start, baseline_finish=pt.baseline_finish,
            actual_start=pt.actual_start, actual_finish=pt.actual_finish,
            duration_hours=pt.duration_hours,
            baseline_duration_hours=pt.baseline_duration_hours,
            actual_duration_hours=pt.actual_duration_hours,
            remaining_duration_hours=pt.remaining_duration_hours,
            percent_complete=pt.percent_complete,
            physical_percent_complete=pt.physical_percent_complete,
            cost=pt.cost, baseline_cost=pt.baseline_cost,
            actual_cost=pt.actual_cost, remaining_cost=pt.remaining_cost,
            fixed_cost=pt.fixed_cost,
            bcws=pt.bcws, bcwp=pt.bcwp, acwp=pt.acwp,
            critical=pt.critical, milestone=pt.milestone,
            summary=pt.summary, is_null=pt.is_null,
            free_slack_hours=pt.free_slack_hours,
            total_slack_hours=pt.total_slack_hours,
            resource_names=pt.resource_names,
            predecessor_uids=pt.predecessor_uids,
            notes=pt.notes,
        ))

    for pr in parsed.resources:
        project.resources.append(Resource(
            resource_uid=pr.uid, name=pr.name,
            resource_type=pr.resource_type, max_units=pr.max_units,
            standard_rate=pr.standard_rate, overtime_rate=pr.overtime_rate,
            cost=pr.cost, actual_cost=pr.actual_cost,
        ))

    for pa in parsed.assignments:
        project.assignments.append(Assignment(
            assignment_uid=pa.uid, task_uid=pa.task_uid,
            resource_uid=pa.resource_uid,
            work_hours=pa.work_hours, actual_work_hours=pa.actual_work_hours,
            baseline_work_hours=pa.baseline_work_hours,
            remaining_work_hours=pa.remaining_work_hours,
            cost=pa.cost, actual_cost=pa.actual_cost,
            baseline_cost=pa.baseline_cost,
            start=pa.start, finish=pa.finish,
            actual_start=pa.actual_start, actual_finish=pa.actual_finish,
        ))

    return project
